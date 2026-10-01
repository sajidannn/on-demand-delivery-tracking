import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch() // Kosongkan agar menangkap SEMUA jenis error
export class RpcExceptionToHttpFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Biarkan Error HTTP bawaan (seperti 400 Bad Request dari DTO) lewat apa adanya
    if (exception instanceof HttpException) {
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    // 2. Ekstrak data dari error TCP (berupa objek murni)
    const code = exception?.code || 'INTERNAL_ERROR';
    const message = exception?.message || 'Terjadi kesalahan internal';

    // 3. Petakan kode TCP ke kode HTTP
    let status = HttpStatus.INTERNAL_SERVER_ERROR; // Default: 500

    if (code === 'EMAIL_TAKEN') status = HttpStatus.CONFLICT; // 409
    if (code === 'UNAUTHORIZED') status = HttpStatus.UNAUTHORIZED; // 401
    if (code === 'NOT_FOUND') status = HttpStatus.NOT_FOUND; // 404

    // 4. Kirimkan balasan JSON
    response.status(status).json({
      statusCode: status,
      errorCode: code,
      message: message,
    });
  }
}
