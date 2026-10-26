import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma-client';

/**
 * Data access for password-reset tokens.
 *
 * Current: Prisma persistence (real PostgreSQL).
 * Future consolidated DB phase:
 *   edu.sp_auth_request_password_reset
 *   edu.sp_auth_consume_password_reset
 *
 * Controllers and domain services must not call Prisma/raw SQL directly
 * for these operations — use this repository.
 */
@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Invalidate prior unused tokens and create a new hashed reset token.
   * Future: edu.sp_auth_request_password_reset
   * Status: PLANNED — consolidated database phase
   */
  async createResetToken(params: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: params.userId,
          tenantId: params.tenantId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      const created = await tx.passwordResetToken.create({
        data: {
          userId: params.userId,
          tenantId: params.tenantId,
          tokenHash: params.tokenHash,
          expiresAt: params.expiresAt,
        },
        select: { id: true },
      });

      return created;
    });
  }

  /**
   * Lookup by hash only. Never accept raw tokens here.
   * Future: part of edu.sp_auth_consume_password_reset
   * Status: PLANNED — consolidated database phase
   */
  async findByTokenHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            status: true,
            deletedAt: true,
            tenant: { select: { status: true, deletedAt: true } },
          },
        },
      },
    });
  }

  /**
   * Consume reset token, update password, revoke sessions, invalidate other tokens.
   * Future: edu.sp_auth_consume_password_reset
   * Status: PLANNED — consolidated database phase
   *
   * Transactional: all-or-nothing.
   */
  async consumeResetToken(params: {
    resetTokenId: string;
    userId: string;
    tenantId: string;
    passwordHash: string;
    unlockIfLocked: boolean;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: params.resetTokenId },
        data: { usedAt: new Date() },
      });

      const userUpdate: Prisma.UserUpdateInput = {
        passwordHash: params.passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      };
      if (params.unlockIfLocked) {
        userUpdate.status = 'ACTIVE';
      }

      await tx.user.update({
        where: { id: params.userId },
        data: userUpdate,
      });

      await tx.refreshToken.updateMany({
        where: {
          userId: params.userId,
          tenantId: params.tenantId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: params.userId,
          tenantId: params.tenantId,
          usedAt: null,
          id: { not: params.resetTokenId },
        },
        data: { usedAt: new Date() },
      });
    });
  }
}
