import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Data access for account activation tokens.
 *
 * Current: Prisma → PostgreSQL.
 * Future consolidated DB phase:
 *   edu.sp_auth_create_activation_token
 *   edu.sp_auth_activate_account
 * Status: PLANNED
 *
 * Pending activation is represented as User.status = INACTIVE with activatedAt = null.
 * Successful activation sets status = ACTIVE and activatedAt = now().
 * No new UserStatus enum values are introduced in this step.
 */
@Injectable()
export class ActivationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Invalidate prior unused activation tokens and create a new hashed token.
   * Future: edu.sp_auth_create_activation_token
   * Status: PLANNED — consolidated database phase
   */
  async createActivationToken(params: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.activationToken.updateMany({
        where: {
          userId: params.userId,
          tenantId: params.tenantId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      return tx.activationToken.create({
        data: {
          userId: params.userId,
          tenantId: params.tenantId,
          tokenHash: params.tokenHash,
          expiresAt: params.expiresAt,
        },
        select: { id: true },
      });
    });
  }

  /**
   * Lookup by hash only. Never accept raw tokens.
   * Future: part of edu.sp_auth_activate_account
   */
  async findByTokenHash(tokenHash: string) {
    return this.prisma.activationToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            status: true,
            activatedAt: true,
            deletedAt: true,
            tenant: { select: { status: true, deletedAt: true } },
          },
        },
      },
    });
  }

  /**
   * Atomically: mark token used, set password, activate user.
   * Future: edu.sp_auth_activate_account
   * Status: PLANNED — consolidated database phase
   *
   * Does NOT accept or set role/persona/tenant from client input.
   */
  async activateAccount(params: {
    activationTokenId: string;
    userId: string;
    tenantId: string;
    passwordHash: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.activationToken.update({
        where: { id: params.activationTokenId },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: params.userId },
        data: {
          passwordHash: params.passwordHash,
          status: 'ACTIVE',
          activatedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });

      // Invalidate any other unused activation tokens for this user
      await tx.activationToken.updateMany({
        where: {
          userId: params.userId,
          tenantId: params.tenantId,
          usedAt: null,
          id: { not: params.activationTokenId },
        },
        data: { usedAt: new Date() },
      });
    });
  }
}
