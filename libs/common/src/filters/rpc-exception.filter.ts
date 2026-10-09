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
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Pemetaan status numerik gRPC ke kode string */
const GRPC_CODE_TO_STRING: Record<number, string> = {
  3: 'VALIDATION_ERROR',
  5: 'NOT_FOUND',
  7: 'FORBIDDEN',
  14: 'SERVICE_UNAVAILABLE',
  16: 'UNAUTHORIZED',
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

      let code = HTTP_STATUS_TO_CODE[status] ?? 'INTERNAL';
      let message: string | string[];
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as { message?: string | string[], code?: string };
        message = b.message ?? exception.message;
        if (b.code) code = b.code;
      }

      return response.status(status).json({
        statusCode: status,
        code,
        message,
      });
    }

    // 2. Error koneksi microservice / timeout (service down atau tidak merespons)
    const err = exception as Record<string, unknown>;
    const rawCode = typeof err?.code === 'string' ? err.code : '';
    const errName = typeof err?.name === 'string' ? err.name : '';

    if (
      rawCode === 'ECONNREFUSED' ||
      rawCode === 'ECONNRESET' ||
      errName === 'TimeoutError'
    ) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Layanan tidak tersedia',
      });
    }

    // 3. Error dari microservice TCP/gRPC (objek murni dari RpcException)
    let code = 'INTERNAL';
    if (typeof err?.code === 'string' && err.code in RPC_CODE_TO_STATUS) {
      code = err.code as string;
    } else if (typeof err?.code === 'number') {
      code = GRPC_CODE_TO_STRING[err.code as number] || 'INTERNAL';
    }

    let message =
      typeof err?.message === 'string'
        ? err.message
        : 'Terjadi kesalahan internal';

    // Hapus prefix gRPC seperti "3 INVALID_ARGUMENT: " dari message
    message = message.replace(/^\d+\s+[A-Z_]+:\s*/, '');

    const status = RPC_CODE_TO_STATUS[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      code,
      message,
    });
  }
}
