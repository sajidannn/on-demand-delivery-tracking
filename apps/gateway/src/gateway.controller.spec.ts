import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('GatewayController', () => {
  let controller: GatewayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [GatewayService],
    }).compile();

    controller = module.get<GatewayController>(GatewayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health → { status: "ok" }', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
