import { RmqOptions, Transport } from '@nestjs/microservices';
import { RMQ_QUEUE_OPTIONS } from '../constants/index.js';

export function getRmqOptions(url: string, queueName: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: queueName,
      queueOptions: RMQ_QUEUE_OPTIONS,
      persistent: true,
    },
  };
}
