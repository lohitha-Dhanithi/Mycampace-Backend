import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonaType } from '../../../generated/prisma-client';

/**
 * Future: edu.sp_auth_register_user | edu.sp_auth_register_request | edu.sp_user_role_assign
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class RegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTenantByCode(code: string) {
    return this.prisma.tenant.findFirst({
      where: { code, deletedAt: null },
    });
  }

  findUserByEmailTenant(email: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { email, tenantId, deletedAt: null },
    });
  }

  /**
   * Self-registration: create INACTIVE user + PENDING user_role + return user id.
   * Does not activate. Does not grant ACTIVE role until activation.
   */
  async createSelfRegisteredUser(params: {
    tenantId: string;
    email: string;
    passwordHash: string;
    personaType: PersonaType;
    roleId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: params.tenantId,
          email: params.email,
          passwordHash: params.passwordHash,
          personaType: params.personaType,
          status: 'INACTIVE',
          mfaEnabled: false,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: params.roleId,
          tenantId: params.tenantId,
          status: 'PENDING',
        },
      });

      return user;
    });
  }

  /** Privileged path: store request only — no role grant. */
  async createRegistrationRequest(params: {
    tenantId: string;
    email: string;
    requestedRoleId: string;
    expiresAt: Date;
  }) {
    return this.prisma.registrationRequest.create({
      data: {
        tenantId: params.tenantId,
        email: params.email,
        requestedRoleId: params.requestedRoleId,
        status: 'PENDING',
        expiresAt: params.expiresAt,
      },
    });
  }

  /** After activation: promote PENDING user_roles to ACTIVE for this user. */
  async activatePendingRoles(userId: string, tenantId: string) {
    return this.prisma.userRole.updateMany({
      where: { userId, tenantId, status: 'PENDING' },
      data: { status: 'ACTIVE', assignedAt: new Date() },
    });
  }
}
