import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../enums/order-status.enum.js';

export class CoordinateDto {
  @ApiProperty({ example: -6.9147 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 107.6098 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: CoordinateDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  pickup: CoordinateDto;

  @ApiProperty({ type: CoordinateDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  dropoff: CoordinateDto;
}

export class CreateOrderPayloadDto extends CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  customerId: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [OrderStatus.PICKED_UP, OrderStatus.COMPLETED],
    example: OrderStatus.PICKED_UP,
  })
  @IsIn([OrderStatus.PICKED_UP, OrderStatus.COMPLETED])
  @IsNotEmpty()
  status: OrderStatus;
}

export class UpdateOrderStatusPayloadDto extends UpdateOrderStatusDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @IsUUID()
  @IsNotEmpty()
  driverId: string;
}

export class OrderDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  customerId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002' })
  driverId?: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.DRIVER_ASSIGNED })
  status: OrderStatus;

  @ApiProperty({ type: CoordinateDto })
  pickup: CoordinateDto;

  @ApiProperty({ type: CoordinateDto })
  dropoff: CoordinateDto;

  @ApiProperty({ example: 1650 })
  distanceM: number;

  @ApiProperty({ example: 10000 })
  fee: number;

  @ApiProperty({ example: '2026-10-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-01T12:05:00Z' })
  updatedAt: Date;
}
