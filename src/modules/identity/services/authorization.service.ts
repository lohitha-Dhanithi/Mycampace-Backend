import { Injectable } from '@nestjs/common';
import { AuthorizationRepository } from '../repositories/authorization.repository';

export interface AuthorizationSnapshot {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

/**
 * Central authorization evaluation — deny by default.
 * JWT identifies the user; permissions are resolved from DB (not JWT claims).
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly repo: AuthorizationRepository) {}

  async getSnapshot(
    userId: string,
    tenantId: string,
  ): Promise<AuthorizationSnapshot> {
    const [roles, permissions] = await Promise.all([
      this.repo.getActiveRoleCodes(userId, tenantId),
      this.repo.getActivePermissionCodes(userId, tenantId),
    ]);
    return { userId, tenantId, roles, permissions };
  }

  async hasPermission(
    userId: string,
    tenantId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const permissions = await this.repo.getActivePermissionCodes(
      userId,
      tenantId,
    );
    return permissions.includes(permissionCode);
  }

  async hasAnyPermission(
    userId: string,
    tenantId: string,
    codes: string[],
  ): Promise<boolean> {
    if (!codes.length) return false;
    const permissions = await this.repo.getActivePermissionCodes(
      userId,
      tenantId,
    );
    return codes.some((c) => permissions.includes(c));
  }

  listPermissionCatalog() {
    return this.repo.listPermissions();
  }

  listRoleCatalog() {
    return this.repo.listRolesWithPermissionCount();
  }
}
