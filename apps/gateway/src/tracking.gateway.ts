import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  BaseWsExceptionFilter,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UseFilters, UsePipes, ValidationPipe, Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_SERVICE_TOKEN,
  LOCATION_CLIENT_TOKEN,
  ORDER_SERVICE_TOKEN,
  PATTERNS,
  EVENTS,
  WS_EVENTS,
  callService,
  userRoom,
  orderRoom,
  Role,
  OrderStatus,
} from '@app/common';
import {
  DriverLocationWsDto,
  OrderLocationPayload,
  OrderSubscribeDto,
  OrderStatusPayload,
} from '@app/common';

@WebSocketGateway()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => {
      const messages = errors.map(
        (e) => Object.values(e.constraints || {})[0] || 'Validation error',
      );
      return new WsException({ code: 'VALIDATION_ERROR', message: messages });
    },
  }),
)
@UseFilters(new BaseWsExceptionFilter())
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(AUTH_SERVICE_TOKEN) private readonly authClient: ClientProxy,
    @Inject(ORDER_SERVICE_TOKEN) private readonly orderClient: ClientProxy,
    @Inject(LOCATION_CLIENT_TOKEN) private readonly locationClient: ClientProxy,
  ) {}

  async handleConnection(client: Socket) {
    let token =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization || '').split(' ')[1];
    let isCookie = false;

    if (!token) {
      const cookieHeader = client.handshake.headers?.cookie;
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookieString) => {
          const [key, ...val] = cookieString.trim().split('=');
          if (key) acc[key] = val.join('=');
          return acc;
        }, {} as Record<string, string>);
        const cookieName = process.env.AUTH_COOKIE_NAME || 'access_token';
        token = cookies[cookieName];
        isCookie = !!token;
      }
    }

    if (!token) {
      client.disconnect(true);
      return;
    }

    if (isCookie) {
      const origin = client.handshake.headers?.origin;
      const rawOrigins = process.env.CORS_ORIGINS ?? '';
      const corsOrigins = rawOrigins.split(',').map((o) => o.trim());
      if (!origin || !corsOrigins.includes(origin)) {
        client.disconnect(true);
        return;
      }
    }

    try {
      const user = await firstValueFrom(
        callService(
          this.authClient.send(PATTERNS.AUTH.VALIDATE_TOKEN, { token }),
          'auth-service',
          3000,
        ),
      );

      client.data.user = user;
      void client.join(userRoom(user.userId));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.activeOrders) {
      client.data.activeOrders.clear();
    }
  }

  @SubscribeMessage(WS_EVENTS.DRIVER_LOCATION)
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: DriverLocationWsDto,
  ) {
    const user = client.data.user;
    if (!user || user.role !== Role.DRIVER) {
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Only drivers allowed',
      });
    }

    const driverId = user.userId;

    this.locationClient.emit(EVENTS.DRIVER.LOCATION_UPDATED, {
      driverId,
      lat: dto.lat,
      lng: dto.lng,
      ts: Date.now(),
    }).subscribe({
      error: (err) => this.logger.warn(`Failed to emit location to RMQ: ${(err as Error)?.message || err}`),
    });
    this.logger.debug(`[driver:location] Forwarded to RMQ for ${driverId}`);

    if (dto.orderId) {
      await this.forwardLocationToRoom(client, driverId, dto);
    }
  }

  private async forwardLocationToRoom(
    client: Socket,
    driverId: string,
    dto: DriverLocationWsDto,
  ) {
    const { orderId, lat, lng } = dto;
    if (!orderId) return;

    if (!client.data.activeOrders) {
      client.data.activeOrders = new Map<string, boolean>();
    }

    if (!client.data.activeOrders.has(orderId)) {
      const order = await firstValueFrom(
        callService(
          this.orderClient.send(PATTERNS.ORDER.GET, {
            orderId,
            userId: driverId,
            role: Role.DRIVER,
          }),
          'order-service',
          3000,
        ),
      ).catch(() => null);

      const allowed =
        order &&
        order.driverId === driverId &&
        [OrderStatus.DRIVER_ASSIGNED, OrderStatus.PICKED_UP].includes(
          order.status,
        );

      if (allowed) {
        client.data.activeOrders.set(orderId, true);
      }
    }

    if (!client.data.activeOrders.get(orderId)) {
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Order mismatch or not in active state',
      });
    }

    const payload: OrderLocationPayload = {
      orderId,
      lat,
      lng,
      ts: Date.now(),
    };
    this.server.to(orderRoom(orderId)).emit(WS_EVENTS.ORDER_LOCATION, payload);
  }

  @SubscribeMessage(WS_EVENTS.ORDER_SUBSCRIBE)
  async handleOrderSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: OrderSubscribeDto,
  ): Promise<{ ok: boolean; status?: string; driverId?: string }> {
    const user = client.data.user;
    if (!user || user.role !== Role.CUSTOMER) {
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Only customers allowed',
      });
    }

    let order;
    try {
      order = await firstValueFrom(
        callService(
          this.orderClient.send(PATTERNS.ORDER.GET, {
            orderId: dto.orderId,
            userId: user.userId,
            role: Role.CUSTOMER,
          }),
          'order-service',
          3000,
        ),
      );
    } catch (err) {
      throw new WsException(err as object);
    }

    void client.join(orderRoom(dto.orderId));
    return { ok: true, status: order.status, driverId: order.driverId };
  }

  broadcastOrderStatus(
    payload: OrderStatusPayload,
    customerId: string,
    driverId?: string,
  ) {
    const rooms = [orderRoom(payload.orderId), userRoom(customerId)];
    if (driverId) {
      rooms.push(userRoom(driverId));
    }
    this.server.to(rooms).emit(WS_EVENTS.ORDER_STATUS, payload);
  }

  clearOrderCache(orderId: string) {
    if (!this.server?.sockets?.sockets) return;
    this.server.sockets.sockets.forEach((socket) => {
      if (socket.data?.activeOrders) {
        socket.data.activeOrders.delete(orderId);
      }
    });
  }
}
