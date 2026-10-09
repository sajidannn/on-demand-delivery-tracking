import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GatewayModule } from './gateway.module.js';
import {
  RpcExceptionToHttpFilter,
  GATEWAY_QUEUE,
  getRmqOptions,
} from '@app/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  const rawOrigins = process.env.CORS_ORIGINS ?? '';
  if (!rawOrigins || rawOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS harus diisi dan tidak boleh mengandung *');
  }
  const corsOrigins = rawOrigins.split(',').map((o) => o.trim());

  app.use(cookieParser());
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || corsOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  class CorsIoAdapter extends IoAdapter {
    createIOServer(port: number, options?: any): any {
      const mergedOptions = {
        ...options,
        cors: { origin: corsOrigins, credentials: true },
      };
      return super.createIOServer(port, mergedOptions);
    }
  }
  app.useWebSocketAdapter(new CorsIoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new RpcExceptionToHttpFilter());

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('On-Demand Delivery API')
    .setDescription('API Gateway untuk sistem delivery tracking')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(process.env.AUTH_COOKIE_NAME || 'access_token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.connectMicroservice<MicroserviceOptions>(
    getRmqOptions(
      process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
      GATEWAY_QUEUE,
    ),
  );

  await app.startAllMicroservices();
  await app.listen(process.env.GATEWAY_PORT ?? 3000);
}
await bootstrap();
