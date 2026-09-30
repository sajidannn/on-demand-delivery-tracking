import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
