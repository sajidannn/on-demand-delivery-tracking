export const GATEWAY_QUEUE = 'gateway_queue';
export const NOTIFICATION_QUEUE = 'notification_queue';
export const LOCATION_QUEUE = 'location_queue';

export const NOTIFICATION_CLIENT_TOKEN = 'NOTIFICATION_CLIENT';
export const GATEWAY_CLIENT_TOKEN = 'GATEWAY_CLIENT';
export const RMQ_QUEUE_OPTIONS = { durable: true } as const;

export const AUTH_SERVICE_TOKEN = 'AUTH_SERVICE';
export const ORDER_SERVICE_TOKEN = 'ORDER_SERVICE';

export const PATTERNS = {
  AUTH: {
    REGISTER: 'auth.register',
    LOGIN: 'auth.login',
    VALIDATE_TOKEN: 'auth.validate_token',
    ME: 'auth.me',
  },
  ORDER: {
    CREATE: 'order.create',
    GET: 'order.get',
    LIST: 'order.list',
    UPDATE_STATUS: 'order.update_status',
    ESTIMATE: 'order.estimate',
  },
};

export const EVENTS = {
  DRIVER: {
    LOCATION_UPDATED: 'driver.location_updated',
  },
  ORDER: {
    CREATED: 'order.created',
    DRIVER_ASSIGNED: 'order.driver_assigned',
    STATUS_CHANGED: 'order.status_changed',
  },
};

export const WS_EVENTS = {
  DRIVER_LOCATION: 'driver:location', // client → server
  ORDER_SUBSCRIBE: 'order:subscribe', // client → server
  ORDER_LOCATION: 'order:location', // server → client
  ORDER_STATUS: 'order:status', // server → client
} as const;

export const orderRoom = (orderId: string) => `order:${orderId}`;
export const userRoom = (userId: string) => `user:${userId}`;

export const LOCATION_CLIENT_TOKEN = 'LOCATION_CLIENT';
