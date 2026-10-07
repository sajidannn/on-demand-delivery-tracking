import { IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DriverLocationWsDto {
  @ApiProperty({ example: -6.9147 })
  @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @ApiProperty({ example: 107.6098 })
  @IsNumber() @Min(-180) @Max(180)
  lng!: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  orderId?: string;
}
