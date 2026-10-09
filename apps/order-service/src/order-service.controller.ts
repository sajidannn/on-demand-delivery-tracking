import { Controller, ValidationPipe, UsePipes } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderServiceService } from './order-service.service.js';
import {
  CreateOrderPayloadDto,
  EstimateOrderDto,
  OrderDto,
  OrderEstimateDto,
  Role,
  UpdateOrderStatusPayloadDto,
  PATTERNS,
} from '@app/common';

@Controller()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class OrderServiceController {
  constructor(private readonly orderServiceService: OrderServiceService) {}

  @MessagePattern(PATTERNS.ORDER.CREATE)
  async createOrder(@Payload() data: CreateOrderPayloadDto): Promise<OrderDto> {
    return this.orderServiceService.create(data);
  }

  @MessagePattern(PATTERNS.ORDER.GET)
  async getOrder(
    @Payload() data: { orderId: string; userId: string; role: Role },
  ): Promise<OrderDto> {
    return this.orderServiceService.get(data.orderId, data.userId, data.role);
  }

  @MessagePattern(PATTERNS.ORDER.LIST)
  async listOrders(
    @Payload() data: { userId: string; role: Role },
  ): Promise<OrderDto[]> {
    return this.orderServiceService.list(data.userId, data.role);
  }

  @MessagePattern(PATTERNS.ORDER.UPDATE_STATUS)
  async updateOrderStatus(
    @Payload() data: UpdateOrderStatusPayloadDto,
  ): Promise<OrderDto> {
    return this.orderServiceService.updateStatus(data);
  }

  @MessagePattern(PATTERNS.ORDER.ESTIMATE)
  async estimateOrder(
    @Payload() data: EstimateOrderDto,
  ): Promise<OrderEstimateDto> {
    return this.orderServiceService.estimate(data);
  }
}
