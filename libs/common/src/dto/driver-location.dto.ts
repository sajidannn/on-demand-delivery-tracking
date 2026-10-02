import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber } from 'class-validator';

export class DriverLocationDto {
  @ApiProperty({ example: -6.9147, description: 'Latitude' })
  @IsNotEmpty()
  @IsNumber()
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 107.6098, description: 'Longitude' })
  @IsNotEmpty()
  @IsNumber()
  @IsLongitude()
  lng: number;
}
