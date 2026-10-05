import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum.js';

export class UserResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'customer@example.com' })
  email!: string;

  @ApiProperty({ example: 'Budi Santoso' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;
}

export class TokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...' })
  accessToken!: string;
}

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Invalid coordinate' },
      { type: 'array', items: { type: 'string' }, example: ['Lat must be a number'] }
    ]
  })
  message!: string | string[];
}
