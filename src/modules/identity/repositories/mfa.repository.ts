import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MfaFactorStatus, MfaFactorType } from '../../../generated/prisma-client';

/**
 * Permanent MFA factor persistence.
 * Future: edu.sp_auth_mfa_factor_create | _get | _verify | _disable
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class MfaRepository {
  constructor(private readonly prisma: PrismaService) {}

  createPendingTotp(params: {
    userId: string;
    tenantId: string;
    displayName: string;
    encryptedSecret: string;
  }) {
    return this.prisma.mfaFactor.create({
      data: {
        userId: params.userId,
        tenantId: params.tenantId,
        type: MfaFactorType.TOTP,
        status: MfaFactorStatus.PENDING,
        displayName: params.displayName,
        encryptedSecret: params.encryptedSecret,
      },
    });
  }

  findByIdForUser(factorId: string, userId: string, tenantId: string) {
    return this.prisma.mfaFactor.findFirst({
      where: { id: factorId, userId, tenantId },
    });
  }

  findActiveTotp(userId: string, tenantId: string) {
    return this.prisma.mfaFactor.findFirst({
      where: {
        userId,
        tenantId,
        type: MfaFactorType.TOTP,
        status: MfaFactorStatus.ACTIVE,
      },
    });
  }

  listForUser(userId: string, tenantId: string) {
    return this.prisma.mfaFactor.findMany({
      where: { userId, tenantId, status: { not: MfaFactorStatus.REVOKED } },
      select: {
        id: true,
        type: true,
        status: true,
        displayName: true,
        verifiedAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  activateFactor(factorId: string) {
    return this.prisma.mfaFactor.update({
      where: { id: factorId },
      data: {
        status: MfaFactorStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });
  }

  disableFactor(factorId: string) {
    return this.prisma.mfaFactor.update({
      where: { id: factorId },
      data: {
        status: MfaFactorStatus.DISABLED,
        disabledAt: new Date(),
      },
    });
  }

  touchLastUsed(factorId: string) {
    return this.prisma.mfaFactor.update({
      where: { id: factorId },
      data: { lastUsedAt: new Date() },
    });
  }

  setUserMfaEnabled(userId: string, enabled: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: enabled },
    });
  }

  countActiveFactors(userId: string, tenantId: string) {
    return this.prisma.mfaFactor.count({
      where: { userId, tenantId, status: MfaFactorStatus.ACTIVE },
    });
  }
}
