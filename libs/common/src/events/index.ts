import { OrderStatus } from '../enums/order-status.enum.js';

export interface DriverLocationUpdatedEvent {
  driverId: string;
  lat: number;
  lng: number;
  ts: number;
}

export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  at: string;
}

export interface OrderDriverAssignedEvent {
  orderId: string;
  customerId: string;
  driverId: string;
  at: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  customerId: string;
  driverId?: string;
  status: OrderStatus;
  fee?: number;
  distanceM?: number;
  at: string;
}

export interface OrderLocationPayload {
  orderId: string;
  lat: number;
  lng: number;
  ts: number;
}

export interface OrderStatusPayload {
  orderId: string;
  status: OrderStatus;
  driverId?: string;
  at: string;
}
