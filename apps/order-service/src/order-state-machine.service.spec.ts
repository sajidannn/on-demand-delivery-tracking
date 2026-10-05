import { OrderStateMachine } from './order-state-machine.service.js';
import { OrderStatus } from '@app/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { RpcException } from '@nestjs/microservices';

describe('OrderStateMachine', () => {
  let stateMachine: OrderStateMachine;

  beforeEach(() => {
    stateMachine = new OrderStateMachine();
  });

  describe('Valid transitions', () => {
    it('should allow PENDING to DRIVER_ASSIGNED', () => {
      expect(() =>
        stateMachine.validateTransition(
          OrderStatus.PENDING,
          OrderStatus.DRIVER_ASSIGNED,
        ),
      ).not.toThrow();
    });

    it('should allow PENDING to NO_DRIVER_AVAILABLE', () => {
      expect(() =>
        stateMachine.validateTransition(
          OrderStatus.PENDING,
          OrderStatus.NO_DRIVER_AVAILABLE,
        ),
      ).not.toThrow();
    });

    it('should allow DRIVER_ASSIGNED to PICKED_UP', () => {
      expect(() =>
        stateMachine.validateTransition(
          OrderStatus.DRIVER_ASSIGNED,
          OrderStatus.PICKED_UP,
        ),
      ).not.toThrow();
    });

    it('should allow PICKED_UP to COMPLETED', () => {
      expect(() =>
        stateMachine.validateTransition(
          OrderStatus.PICKED_UP,
          OrderStatus.COMPLETED,
        ),
      ).not.toThrow();
    });
  });

  describe('Invalid transitions', () => {
    const testInvalidTransition = (from: OrderStatus, to: OrderStatus) => {
      try {
        stateMachine.validateTransition(from, to);
        expect.fail('Should have thrown RpcException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(RpcException);
        expect(err.getError()).toMatchObject({
          code: 'INVALID_STATUS_TRANSITION',
        });
      }
    };

    it('should reject PENDING to COMPLETED', () => {
      testInvalidTransition(OrderStatus.PENDING, OrderStatus.COMPLETED);
    });

    it('should reject PENDING to PICKED_UP', () => {
      testInvalidTransition(OrderStatus.PENDING, OrderStatus.PICKED_UP);
    });

    it('should reject DRIVER_ASSIGNED to NO_DRIVER_AVAILABLE', () => {
      testInvalidTransition(
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.NO_DRIVER_AVAILABLE,
      );
    });

    it('should reject DRIVER_ASSIGNED to COMPLETED', () => {
      testInvalidTransition(OrderStatus.DRIVER_ASSIGNED, OrderStatus.COMPLETED);
    });

    it('should reject transition from COMPLETED', () => {
      testInvalidTransition(OrderStatus.COMPLETED, OrderStatus.PENDING);
    });

    it('should reject transition from NO_DRIVER_AVAILABLE', () => {
      testInvalidTransition(
        OrderStatus.NO_DRIVER_AVAILABLE,
        OrderStatus.PENDING,
      );
    });

    it('should reject self-transition (e.g. PENDING to PENDING)', () => {
      testInvalidTransition(OrderStatus.PENDING, OrderStatus.PENDING);
    });
  });
});
