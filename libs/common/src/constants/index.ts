export const GATEWAY_QUEUE = 'gateway_queue';
export const NOTIFICATION_QUEUE = 'notification_queue';
export const LOCATION_QUEUE = 'location_queue';

export const AUTH_SERVICE_TOKEN = 'AUTH_SERVICE';

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
