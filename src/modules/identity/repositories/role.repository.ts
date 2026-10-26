import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Role catalog access.
 * Future: edu.sp_role_get_registration_options | edu.sp_role_get_by_code
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Safe metadata for registration selector — no permissions. */
  findRegistrationOptions() {
    return this.prisma.role.findMany({
      where: {
        isActive: true,
        tenantId: null,
        OR: [
          { selfRegistrationAllowed: true },
          // Invitation-required roles still appear so users can request access
          { registrationMode: { in: ['SELF', 'INVITATION'] } },
        ],
      },
      select: {
        code: true,
        displayName: true,
        description: true,
        registrationMode: true,
        invitationRequired: true,
        selfRegistrationAllowed: true,
      },
      orderBy: { displayName: 'asc' },
    });
  }

  findActiveByCode(code: string) {
    return this.prisma.role.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        tenantId: null,
      },
    });
  }
}
