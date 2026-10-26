import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Resolves effective permissions for a user within a tenant.
 * Future: edu.sp_auth_get_authorization_context | edu.sp_auth_check_permission
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class AuthorizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePermissionCodes(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        status: 'ACTIVE',
        role: { isActive: true },
      },
      select: {
        role: {
          select: {
            code: true,
            rolePermissions: {
              where: { permission: { isActive: true } },
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    const codes = new Set<string>();
    for (const ur of rows) {
      for (const rp of ur.role.rolePermissions) {
        codes.add(rp.permission.code);
      }
    }
    return [...codes];
  }

  async getActiveRoleCodes(userId: string, tenantId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        status: 'ACTIVE',
        role: { isActive: true },
      },
      select: { role: { select: { code: true } } },
    });
    return rows.map((r) => r.role.code);
  }

  listPermissions() {
    return this.prisma.permission.findMany({
      where: { isActive: true },
      select: {
        code: true,
        displayName: true,
        description: true,
        module: true,
        action: true,
      },
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  listRolesWithPermissionCount() {
    return this.prisma.role.findMany({
      where: { isActive: true, tenantId: null },
      select: {
        code: true,
        displayName: true,
        description: true,
        _count: { select: { rolePermissions: true } },
      },
      orderBy: { displayName: 'asc' },
    });
  }
}
