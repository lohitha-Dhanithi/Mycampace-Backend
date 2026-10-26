import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../generated/prisma-client';

/**
 * Future: edu.sp_branding_* | edu.sp_theme_template_* | edu.sp_branding_asset_*
 * Status: PLANNED — consolidated DB phase
 */
@Injectable()
export class BrandingRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveTemplates() {
    return this.prisma.themeTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        name: true,
        description: true,
        tokensJson: true,
        isSystem: true,
      },
    });
  }

  findTemplateByCode(code: string) {
    return this.prisma.themeTemplate.findFirst({
      where: { code, isActive: true },
    });
  }

  findInstitutionById(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
  }

  findInstitutionForTenant(institutionId: string, tenantId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, tenantId, deletedAt: null },
    });
  }

  findProfile(institutionId: string, tenantId: string, status: string) {
    return this.prisma.brandingProfile.findFirst({
      where: { institutionId, tenantId, status },
    });
  }

  upsertDraft(params: {
    tenantId: string;
    institutionId: string;
    displayName?: string | null;
    shortName?: string | null;
    welcomeMessage?: string | null;
    templateCode?: string | null;
    tokensJson: Prisma.InputJsonValue;
  }) {
    return this.prisma.brandingProfile.upsert({
      where: {
        institutionId_status: {
          institutionId: params.institutionId,
          status: 'DRAFT',
        },
      },
      create: {
        tenantId: params.tenantId,
        institutionId: params.institutionId,
        status: 'DRAFT',
        displayName: params.displayName,
        shortName: params.shortName,
        welcomeMessage: params.welcomeMessage,
        templateCode: params.templateCode,
        tokensJson: params.tokensJson,
        version: 1,
      },
      update: {
        displayName: params.displayName,
        shortName: params.shortName,
        welcomeMessage: params.welcomeMessage,
        templateCode: params.templateCode,
        tokensJson: params.tokensJson,
      },
    });
  }

  async publish(params: {
    tenantId: string;
    institutionId: string;
    userId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.brandingProfile.findFirst({
        where: {
          tenantId: params.tenantId,
          institutionId: params.institutionId,
          status: 'DRAFT',
        },
      });
      if (!draft) return null;

      // Archive previous published by converting status if unique constraint —
      // unique(institutionId, status) allows one DRAFT and one PUBLISHED.
      const existingPublished = await tx.brandingProfile.findFirst({
        where: {
          institutionId: params.institutionId,
          status: 'PUBLISHED',
        },
      });
      if (existingPublished) {
        await tx.brandingVersion.create({
          data: {
            brandingProfileId: existingPublished.id,
            version: existingPublished.version,
            status: 'PUBLISHED',
            tokensJson: existingPublished.tokensJson as Prisma.InputJsonValue,
            summary: 'Superseded by new publish',
            createdBy: params.userId,
          },
        });
        await tx.brandingProfile.delete({
          where: { id: existingPublished.id },
        });
      }

      const published = await tx.brandingProfile.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          version: draft.version + 1,
        },
      });

      await tx.brandingVersion.create({
        data: {
          brandingProfileId: published.id,
          version: published.version,
          status: 'PUBLISHED',
          tokensJson: published.tokensJson as Prisma.InputJsonValue,
          summary: 'Published',
          createdBy: params.userId,
        },
      });

      // Recreate empty draft for continued editing
      await tx.brandingProfile.create({
        data: {
          tenantId: params.tenantId,
          institutionId: params.institutionId,
          status: 'DRAFT',
          displayName: published.displayName,
          shortName: published.shortName,
          welcomeMessage: published.welcomeMessage,
          templateCode: published.templateCode,
          tokensJson: published.tokensJson as Prisma.InputJsonValue,
          logoAssetId: published.logoAssetId,
          faviconAssetId: published.faviconAssetId,
          loginBgAssetId: published.loginBgAssetId,
          version: published.version,
        },
      });

      return published;
    });
  }

  listVersions(profileId: string) {
    return this.prisma.brandingVersion.findMany({
      where: { brandingProfileId: profileId },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        status: true,
        summary: true,
        createdAt: true,
        createdBy: true,
      },
    });
  }

  createAsset(data: Prisma.BrandingAssetCreateInput) {
    return this.prisma.brandingAsset.create({ data });
  }

  findAsset(id: string, tenantId: string, institutionId: string) {
    return this.prisma.brandingAsset.findFirst({
      where: { id, tenantId, institutionId },
    });
  }

  deleteAsset(id: string, tenantId: string, institutionId: string) {
    return this.prisma.brandingAsset.deleteMany({
      where: { id, tenantId, institutionId },
    });
  }
}
