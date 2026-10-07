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

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

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
