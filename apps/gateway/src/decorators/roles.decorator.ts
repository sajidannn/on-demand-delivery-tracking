import { SetMetadata } from '@nestjs/common';
import { Role } from '@app/common';

export const ROLES_KEY = 'roles';
// Fungsi ini akan menyisipkan meta-data (label) ke rute yang ditempelinya
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
