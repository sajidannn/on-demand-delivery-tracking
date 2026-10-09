import { ApiProperty } from '@nestjs/swagger';

export class RouteGeometryDto {
  @ApiProperty({ example: 'LineString' })
  type: 'LineString';

  @ApiProperty({ example: [[107.6098, -6.9147], [107.6186, -6.9034]] })
  coordinates: [number, number][];
}
