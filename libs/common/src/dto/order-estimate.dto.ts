import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteSource } from '../enums/route-source.enum.js';
import { RouteGeometryDto } from './route-geometry.dto.js';

export class OrderEstimateDto {
  @ApiProperty({ example: 2105 })
  distanceM: number;

  @ApiPropertyOptional({ example: 312 })
  durationS?: number;

  @ApiProperty({ example: 10500 })
  fee: number;

  @ApiProperty({ enum: RouteSource, example: RouteSource.OSRM })
  routeSource: RouteSource;

  @ApiPropertyOptional({ type: RouteGeometryDto })
  route?: RouteGeometryDto;
}
