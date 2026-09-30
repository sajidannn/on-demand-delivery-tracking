export interface DriverLocationUpdatedEvent {
  driverId: string;
  lat: number;
  lng: number;
  ts: number;
}

export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
}

export interface OrderDriverAssignedEvent {
  orderId: string;
  customerId: string;
  driverId: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  customerId: string;
  driverId?: string;
  status: string;
}
