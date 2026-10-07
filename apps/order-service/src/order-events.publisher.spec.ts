import { Test, TestingModule } from '@nestjs/testing';
import { OrderEventsPublisher } from './order-events.publisher.js';
import { NOTIFICATION_CLIENT_TOKEN, GATEWAY_CLIENT_TOKEN, EVENTS, OrderStatus } from '@app/common';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

describe('OrderEventsPublisher', () => {
  let publisher: OrderEventsPublisher;
  let notifClient: any;
  let gatewayClient: any;

  beforeEach(async () => {
    notifClient = {
      emit: vi.fn(() => of(undefined)),
    };
    gatewayClient = {
      emit: vi.fn(() => of(undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderEventsPublisher,
        { provide: NOTIFICATION_CLIENT_TOKEN, useValue: notifClient },
        { provide: GATEWAY_CLIENT_TOKEN, useValue: gatewayClient },
      ],
    }).compile();

    publisher = module.get<OrderEventsPublisher>(OrderEventsPublisher);
  });

  it('created() should only emit to notifClient', async () => {
    const event = { orderId: 'o1', customerId: 'c1' };
    await publisher.created(event);
    expect(notifClient.emit).toHaveBeenCalledWith(EVENTS.ORDER.CREATED, event);
    expect(gatewayClient.emit).not.toHaveBeenCalled();
  });

  it('driverAssigned() should emit to both clients', async () => {
    const event = { orderId: 'o1', customerId: 'c1', driverId: 'd1' };
    await publisher.driverAssigned(event);
    expect(notifClient.emit).toHaveBeenCalledWith(EVENTS.ORDER.DRIVER_ASSIGNED, event);
    expect(gatewayClient.emit).toHaveBeenCalledWith(EVENTS.ORDER.DRIVER_ASSIGNED, event);
  });

  it('statusChanged() should emit to both clients', async () => {
    const event = { orderId: 'o1', customerId: 'c1', status: OrderStatus.COMPLETED };
    await publisher.statusChanged(event);
    expect(notifClient.emit).toHaveBeenCalledWith(EVENTS.ORDER.STATUS_CHANGED, event);
    expect(gatewayClient.emit).toHaveBeenCalledWith(EVENTS.ORDER.STATUS_CHANGED, event);
  });

  it('publish should not throw if emit fails', async () => {
    notifClient.emit.mockReturnValue(throwError(() => new Error('emit error')));
    const event = { orderId: 'o1', customerId: 'c1' };
    
    // Should not reject
    await expect(publisher.created(event)).resolves.toBeUndefined();
    expect(notifClient.emit).toHaveBeenCalled();
  });

  it('publish should timeout and not throw', async () => {
    // delay > 2000ms
    notifClient.emit.mockReturnValue(of(undefined).pipe(delay(2500)));
    const event = { orderId: 'o1', customerId: 'c1' };
    
    await expect(publisher.created(event)).resolves.toBeUndefined();
    expect(notifClient.emit).toHaveBeenCalled();
  });
});
