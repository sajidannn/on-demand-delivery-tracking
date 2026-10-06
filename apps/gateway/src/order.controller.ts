import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Inject,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  CreateOrderDto,
  CreateOrderPayloadDto,
  OrderDto,
  ORDER_SERVICE_TOKEN,
  Role,
  UpdateOrderStatusDto,
  UpdateOrderStatusPayloadDto,
  ErrorResponseDto,
  PATTERNS,
  callService,
} from '@app/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';

interface AuthenticatedRequest {
  user: { userId: string; role: Role };
}

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrderController {
  constructor(
    @Inject(ORDER_SERVICE_TOKEN) private readonly orderClient: ClientProxy,
  ) {}

  @Post()
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Membuat pesanan baru (Hanya Customer)' })
  @ApiResponse({ status: 201, description: 'Pesanan berhasil dibuat', type: OrderDto })
  @ApiResponse({ status: 400, description: 'Payload tidak valid', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token tidak valid (UNAUTHORIZED)', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Hanya customer yang bisa pesan', type: ErrorResponseDto })
  async createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateOrderDto,
  ): Promise<OrderDto> {
    const payload: CreateOrderPayloadDto = {
      ...body,
      customerId: req.user.userId,
    };
    return firstValueFrom(
      callService(this.orderClient.send<OrderDto>(PATTERNS.ORDER.CREATE, payload), 'order-service', 5000),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Mendapatkan daftar pesanan milik user saat ini' })
  @ApiResponse({ status: 200, description: 'Daftar pesanan', type: [OrderDto] })
  @ApiResponse({ status: 401, description: 'Token tidak valid (UNAUTHORIZED)', type: ErrorResponseDto })
  async getOrders(
    @Req() req: AuthenticatedRequest,
  ): Promise<OrderDto[]> {
    return firstValueFrom(
      callService(this.orderClient.send<OrderDto[]>(PATTERNS.ORDER.LIST, { userId: req.user.userId, role: req.user.role }), 'order-service', 5000),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mendapatkan detail pesanan' })
  @ApiResponse({ status: 200, description: 'Detail pesanan', type: OrderDto })
  @ApiResponse({ status: 401, description: 'Token tidak valid (UNAUTHORIZED)', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Akses ditolak', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Pesanan tidak ditemukan', type: ErrorResponseDto })
  async getOrder(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<OrderDto> {
    return firstValueFrom(
      callService(this.orderClient.send<OrderDto>(PATTERNS.ORDER.GET, { orderId, userId: req.user.userId, role: req.user.role }), 'order-service', 5000),
    );
  }

  @Patch(':id/status')
  @Roles(Role.DRIVER)
  @ApiOperation({ summary: 'Mengubah status pesanan (Hanya Driver yang di-assign)' })
  @ApiResponse({ status: 200, description: 'Status berhasil diubah', type: OrderDto })
  @ApiResponse({ status: 400, description: 'Payload tidak valid', type: ErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Token tidak valid (UNAUTHORIZED)', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Hanya driver yang di-assign', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Pesanan tidak ditemukan', type: ErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Transisi status ilegal', type: ErrorResponseDto })
  async updateStatus(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateOrderStatusDto,
  ): Promise<OrderDto> {
    const payload: UpdateOrderStatusPayloadDto = {
      orderId,
      driverId: req.user.userId,
      status: body.status,
    };
    return firstValueFrom(
      callService(this.orderClient.send<OrderDto>(PATTERNS.ORDER.UPDATE_STATUS, payload), 'order-service', 5000),
    );
  }
}
