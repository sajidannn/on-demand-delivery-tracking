import { Role } from '@app/common';

export interface AuthenticatedRequest {
  user: { userId: string; role: Role };
}
