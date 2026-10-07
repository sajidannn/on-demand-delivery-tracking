import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OrderSubscribeDto {
  @ApiProperty({ example: 'uuid-order' })
  @IsUUID()
  orderId!: string;
}
