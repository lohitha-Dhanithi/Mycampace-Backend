import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'required_roles';

/** Prefer RequirePermission for business operations. */
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
