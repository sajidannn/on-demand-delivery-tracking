import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  CreateOrderPayloadDto,
  LOCATION_SERVICE_NAME,
  LocationServiceClient,
  OrderDto,
  OrderStatus,
  Role,
  UpdateOrderStatusPayloadDto,
  callService,
} from '@app/common';
import { OrderRepository, OrderRow } from './order.repository.js';
import { OrderStateMachine } from './order-state-machine.service.js';
import { OrderEventsPublisher } from './order-events.publisher.js';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

@Injectable()
export class OrderServiceService implements OnModuleInit {
  private locationService: LocationServiceClient;
  private readonly logger = new Logger(OrderServiceService.name);

  constructor(
    @Inject(LOCATION_SERVICE_NAME) private readonly client: ClientGrpc,
    private readonly orderRepository: OrderRepository,
    private readonly stateMachine: OrderStateMachine,
    private readonly configService: ConfigService,
    private readonly publisher: OrderEventsPublisher,
  ) {}

  onModuleInit() {
    this.locationService = this.client.getService<LocationServiceClient>(
      LOCATION_SERVICE_NAME,
    );
  }

  private toOrderDto(row: OrderRow): OrderDto {
    return {
      id: row.id,
      customerId: row.customer_id,
      driverId: row.driver_id || undefined,
      status: row.status,
      distanceM: row.distance_m,
      fee: row.fee,
      pickup: { lat: row.pickup_lat, lng: row.pickup_lng },
      dropoff: { lat: row.dropoff_lat, lng: row.dropoff_lng },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async releaseQuietly(orderId: string): Promise<void> {
    try {
      await firstValueFrom(
        callService(
          this.locationService.releaseDriver({ orderId }, new Metadata()),
          'location-service',
          3000,
        ),
      );
    } catch (e) {
      this.logger.error(`Gagal melepas driver untuk order ${orderId}`, e);
    }
  }

  async create(payload: CreateOrderPayloadDto): Promise<OrderDto> {
    const orderRow = await this.orderRepository.createOrder(
      payload.customerId,
      payload.pickup.lat,
      payload.pickup.lng,
      payload.dropoff.lat,
      payload.dropoff.lng,
    );
    this.logger.log(
      `Order created: ${orderRow.id} for customer ${payload.customerId}`,
    );

    this.publisher.created({
      orderId: orderRow.id,
      customerId: payload.customerId,
    }).catch(e => this.logger.error('Failed to publish order.created', e));

    const radiusM = Number(this.configService.get('SEARCH_RADIUS_M', 3000));

    try {
      const response = await firstValueFrom(
        callService(
          this.locationService.reserveNearestDriver(
            {
              orderId: orderRow.id,
              lat: payload.pickup.lat,
              lng: payload.pickup.lng,
              radiusM,
            },
            new Metadata(),
          ),
          'location-service',
          5000,
        ),
      );

      if (response.found && response.driver) {
        this.stateMachine.validateTransition(
          orderRow.status,
          OrderStatus.DRIVER_ASSIGNED,
        );

        const updatedRow = await this.orderRepository.updateDriverAndStatus(
          orderRow.id,
          response.driver.driverId,
          OrderStatus.DRIVER_ASSIGNED,
          orderRow.status,
        );

        if (!updatedRow) {
          throw new RpcException({
            code: 'INTERNAL',
            message: 'Gagal update status order ke DRIVER_ASSIGNED',
          });
        }

        this.logger.log(
          `Driver ${response.driver.driverId} assigned to order ${orderRow.id}`,
        );

        this.publisher.driverAssigned({
          orderId: orderRow.id,
          customerId: payload.customerId,
          driverId: response.driver.driverId,
        }).catch(e => this.logger.error('Failed to publish order.driver_assigned', e));

        return this.toOrderDto(updatedRow);
      } else {
        this.stateMachine.validateTransition(
          orderRow.status,
          OrderStatus.NO_DRIVER_AVAILABLE,
        );

        const updatedRow = await this.orderRepository.updateStatus(
          orderRow.id,
          OrderStatus.NO_DRIVER_AVAILABLE,
          orderRow.status,
        );
        
        const rowToReturn = updatedRow || { ...orderRow, status: OrderStatus.NO_DRIVER_AVAILABLE };
        this.logger.log(`No driver available for order ${orderRow.id}`);

        this.publisher.statusChanged({
          orderId: orderRow.id,
          customerId: payload.customerId,
          status: OrderStatus.NO_DRIVER_AVAILABLE,
        }).catch(e => this.logger.error('Failed to publish order.status_changed', e));

        return this.toOrderDto(rowToReturn);
      }
    } catch (error) {
      this.logger.error(
        `Error reserving driver for order ${orderRow.id}`,
        error,
      );

      await this.releaseQuietly(orderRow.id);

      const updatedRow = await this.orderRepository.updateStatus(
        orderRow.id,
        OrderStatus.NO_DRIVER_AVAILABLE,
        orderRow.status,
      );

      const rowToReturn = updatedRow || { ...orderRow, status: OrderStatus.NO_DRIVER_AVAILABLE };

      this.publisher.statusChanged({
        orderId: orderRow.id,
        customerId: payload.customerId,
        status: OrderStatus.NO_DRIVER_AVAILABLE,
      }).catch(e => this.logger.error('Failed to publish order.status_changed', e));

      return this.toOrderDto(rowToReturn);
    }
  }

  async get(orderId: string, userId: string, role: Role): Promise<OrderDto> {
    const orderRow = await this.orderRepository.findById(orderId);
    if (!orderRow) {
      throw new RpcException({
        code: 'NOT_FOUND',
        message: 'Order tidak ditemukan',
      });
    }

    if (role === Role.CUSTOMER && orderRow.customer_id !== userId) {
      throw new RpcException({ code: 'FORBIDDEN', message: 'Akses ditolak' });
    }
    if (role === Role.DRIVER && orderRow.driver_id !== userId) {
      throw new RpcException({ code: 'FORBIDDEN', message: 'Akses ditolak' });
    }

    return this.toOrderDto(orderRow);
  }

  async list(userId: string, role: Role): Promise<OrderDto[]> {
    if (role === Role.CUSTOMER) {
      const rows = await this.orderRepository.findByCustomerId(userId);
      return rows.map((r) => this.toOrderDto(r));
    } else if (role === Role.DRIVER) {
      const rows = await this.orderRepository.findByDriverId(userId);
      return rows.map((r) => this.toOrderDto(r));
    }
    return [];
  }

  async updateStatus(payload: UpdateOrderStatusPayloadDto): Promise<OrderDto> {
    const orderRow = await this.orderRepository.findById(payload.orderId);
    if (!orderRow) {
      throw new RpcException({
        code: 'NOT_FOUND',
        message: 'Order tidak ditemukan',
      });
    }

    if (orderRow.driver_id !== payload.driverId) {
      throw new RpcException({ code: 'FORBIDDEN', message: 'Akses ditolak' });
    }

    this.stateMachine.validateTransition(orderRow.status, payload.status);

    const updatedRow = await this.orderRepository.updateStatus(
      payload.orderId,
      payload.status,
      orderRow.status,
    );

    if (!updatedRow) {
      throw new RpcException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Order sudah diperbarui oleh proses lain',
      });
    }

    if (payload.status === OrderStatus.COMPLETED) {
      this.releaseQuietly(payload.orderId); // fire and forget
    }

    this.publisher.statusChanged({
      orderId: payload.orderId,
      customerId: orderRow.customer_id,
      driverId: payload.driverId,
      status: payload.status,
    }).catch(e => this.logger.error('Failed to publish order.status_changed', e));

    return this.toOrderDto(updatedRow);
  }
}
