import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';

export function callService<T>(
  observable: Observable<T>,
  serviceName: string,
  timeoutMs = 5000,
): Observable<T> {
  return observable.pipe(
    timeout(timeoutMs),
    catchError((err) => {
      // Identifikasi error karena koneksi/timeout
      if (
        err instanceof TimeoutError ||
        err?.name === 'TimeoutError' ||
        err?.code === 'ECONNREFUSED' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 14 || // gRPC UNAVAILABLE
        err?.code === 'UNAVAILABLE' ||
        err?.message?.includes('14 UNAVAILABLE')
      ) {
        // Melemparkan error sebagai objek murni agar ditangkap dengan benar oleh RpcExceptionToHttpFilter Gateway
        // atau jika di microservice, ini akan ditransfer sebagai objek ke Gateway.
        return throwError(() => ({
          code: 'SERVICE_UNAVAILABLE',
          message: `Layanan ${serviceName} sedang down`,
        }));
      }
      return throwError(() => err);
    }),
  );
}
