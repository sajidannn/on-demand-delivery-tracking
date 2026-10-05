import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/** Pemetaan HTTP status ke kode string sesuai TSD §11 */
const HTTP_STATUS_TO_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

/** Pemetaan kode string RPC ke HTTP status sesuai TSD §11 */
const RPC_CODE_TO_STATUS: Record<string, number> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  INVALID_STATUS_TRANSITION: HttpStatus.CONFLICT,
};

@Catch()
export class RpcExceptionToHttpFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. HttpException (ValidationPipe 400, UnauthorizedException, ForbiddenException, dsb.)
    //    → format ulang ke { statusCode, code, message } sesuai TSD §11
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      // Ambil pesan: bisa string tunggal, array (class-validator), atau objek
      let message: string | string[];
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as { message?: string | string[] };
        message = b.message ?? exception.message;
      }

      return response.status(status).json({
        statusCode: status,
        code: HTTP_STATUS_TO_CODE[status] ?? 'INTERNAL',
        message,
      });
    }

    // 2. Error dari microservice TCP/gRPC (objek murni, bukan Error class)
    const err = exception as Record<string, unknown>;
    const code = (
      typeof err?.code === 'string' ? err.code : 'INTERNAL'
    ) as string;
    const message = (
      typeof err?.message === 'string'
        ? err.message
        : 'Terjadi kesalahan internal'
    ) as string;
    const status = RPC_CODE_TO_STATUS[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      code,
      message,
    });
  }
}
