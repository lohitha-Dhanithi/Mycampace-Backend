import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Future: edu.sp_auth_identity_get | _link | _unlink
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class ExternalIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProviderSubject(
    tenantId: string,
    provider: string,
    providerSubject: string,
  ) {
    return this.prisma.externalIdentity.findUnique({
      where: {
        tenantId_provider_providerSubject: {
          tenantId,
          provider,
          providerSubject,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            personaType: true,
            status: true,
            mfaEnabled: true,
            deletedAt: true,
            tenant: { select: { status: true, deletedAt: true } },
          },
        },
      },
    });
  }

  async link(params: {
    userId: string;
    tenantId: string;
    provider: string;
    providerSubject: string;
    email?: string;
  }) {
    return this.prisma.externalIdentity.create({
      data: {
        userId: params.userId,
        tenantId: params.tenantId,
        provider: params.provider,
        providerSubject: params.providerSubject,
        email: params.email,
        lastLoginAt: new Date(),
      },
    });
  }

  touchLogin(id: string) {
    return this.prisma.externalIdentity.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
