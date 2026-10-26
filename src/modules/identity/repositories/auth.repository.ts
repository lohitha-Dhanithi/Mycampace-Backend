import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Auth-related user/tenant lookups and login-history writes.
 *
 * Current: Prisma.
 * Future routines (PLANNED — consolidated database phase):
 *   edu.sp_auth_login
 *   edu.sp_auth_get_current_user
 *   edu.sp_auth_record_login_history
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmailAndTenantCode(email: string, tenantCode: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { code: tenantCode, deletedAt: null },
    });
    if (!tenant) return null;

    return this.prisma.user.findFirst({
      where: {
        email,
        tenantId: tenant.id,
        deletedAt: null,
      },
      include: {
        tenant: { select: { status: true, deletedAt: true } },
      },
    });
  }

  async findUniqueUserByEmail(email: string) {
    const matches = await this.prisma.user.findMany({
      where: { email, deletedAt: null },
      include: {
        tenant: { select: { status: true, deletedAt: true } },
      },
      take: 2,
    });
    if (matches.length !== 1) return null;
    return matches[0];
  }

  async recordLoginHistory(data: {
    userId?: string;
    tenantId?: string;
    email?: string;
    success: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        email: data.email,
        success: data.success,
        reason: data.reason,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
}
