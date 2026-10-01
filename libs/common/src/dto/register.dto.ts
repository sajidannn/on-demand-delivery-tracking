import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum.js';

export class RegisterDto {
  // @ApiProperty digunakan agar variabel ini terbaca jelas di dokumentasi Swagger Gateway nanti
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Email unik pengguna',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty()
  email!: string;
  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password!: string;
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  name!: string;
  @ApiProperty({
    enum: Role,
    example: Role.CUSTOMER,
    description: 'CUSTOMER atau DRIVER',
  })
  @IsEnum(Role, { message: 'Role harus CUSTOMER atau DRIVER' })
  @IsNotEmpty()
  role!: Role;
}
