import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service.js';
import { PATTERNS, RegisterDto, LoginDto } from '@app/common';

@Controller()
export class AuthServiceController {
  constructor(private readonly authService: AuthServiceService) {}

  @MessagePattern(PATTERNS.AUTH.REGISTER)
  register(@Payload() data: RegisterDto) {
    return this.authService.register(data);
  }

  @MessagePattern(PATTERNS.AUTH.LOGIN)
  login(@Payload() data: LoginDto) {
    return this.authService.login(data);
  }

  @MessagePattern(PATTERNS.AUTH.VALIDATE_TOKEN)
  validateToken(@Payload() data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @MessagePattern(PATTERNS.AUTH.ME)
  me(@Payload() data: { userId: string }) {
    return this.authService.getMe(data.userId);
  }
}
