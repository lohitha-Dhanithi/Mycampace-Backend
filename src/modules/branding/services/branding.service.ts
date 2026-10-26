import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BrandingRepository } from '../repositories/branding.repository';
import { ObjectStorageService } from '../../../common/storage/object-storage.service';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  ApplyTemplateDto,
  UpdateBrandingDto,
  PublishBrandingDto,
} from '../dto/branding.dto';
import { Prisma } from '../../../generated/prisma-client';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);
const MAX_BYTES = 2 * 1024 * 1024;

@Injectable()
export class BrandingService {
  constructor(
    private readonly repo: BrandingRepository,
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
  ) {}

  listTemplates() {
    return this.repo.listActiveTemplates();
  }

  async getBranding(auth: AuthContext, institutionId: string, prefer: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') {
    await this.assertInstitution(auth, institutionId);
    const profile =
      (await this.repo.findProfile(institutionId, auth.tenantId, prefer)) ||
      (await this.repo.findProfile(institutionId, auth.tenantId, 'DRAFT')) ||
      (await this.repo.findProfile(institutionId, auth.tenantId, 'PUBLISHED'));

    if (!profile) {
      return {
        institutionId,
        status: 'NONE',
        tokens: this.defaultTokens(),
        message: 'No branding configured. Choose a theme template to begin.',
      };
    }

    return this.toDto(profile);
  }

  /** Public runtime branding — published only; falls back to EduCore default tokens */
  async getPublishedByInstitution(institutionId: string) {
    const inst = await this.repo.findInstitutionById(institutionId);
    if (!inst) {
      return { tokens: this.defaultTokens(), status: 'FALLBACK' as const };
    }
    const profile = await this.repo.findProfile(
      institutionId,
      inst.tenantId,
      'PUBLISHED',
    );
    if (!profile) {
      return { tokens: this.defaultTokens(), status: 'FALLBACK' as const };
    }
    return this.toDto(profile);
  }

  async applyTemplate(auth: AuthContext, dto: ApplyTemplateDto) {
    await this.assertInstitution(auth, dto.institutionId);
    const template = await this.repo.findTemplateByCode(dto.templateCode);
    if (!template) {
      throw new BadRequestException({
        code: 'BRANDING_TEMPLATE_INVALID',
        message: 'Theme template not found or inactive.',
      });
    }
    const draft = await this.repo.upsertDraft({
      tenantId: auth.tenantId,
      institutionId: dto.institutionId,
      templateCode: template.code,
      tokensJson: template.tokensJson as Prisma.InputJsonValue,
    });
    return this.toDto(draft);
  }

  async updateDraft(auth: AuthContext, dto: UpdateBrandingDto) {
    await this.assertInstitution(auth, dto.institutionId);
    const existing = await this.repo.findProfile(
      dto.institutionId,
      auth.tenantId,
      'DRAFT',
    );
    const base =
      (existing?.tokensJson as Record<string, string>) || this.defaultTokens();
    const tokens = { ...base, ...(dto.tokens || {}) };
    const draft = await this.repo.upsertDraft({
      tenantId: auth.tenantId,
      institutionId: dto.institutionId,
      displayName: dto.displayName ?? existing?.displayName,
      shortName: dto.shortName ?? existing?.shortName,
      welcomeMessage: dto.welcomeMessage ?? existing?.welcomeMessage,
      templateCode: existing?.templateCode,
      tokensJson: tokens,
    });
    return this.toDto(draft);
  }

  async publish(auth: AuthContext, dto: PublishBrandingDto) {
    await this.assertInstitution(auth, dto.institutionId);
    const published = await this.repo.publish({
      tenantId: auth.tenantId,
      institutionId: dto.institutionId,
      userId: auth.userId,
    });
    if (!published) {
      throw new BadRequestException({
        code: 'BRANDING_DRAFT_MISSING',
        message: 'No draft branding to publish. Apply a template first.',
      });
    }
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'branding.publish',
      module: 'branding',
      result: 'SUCCESS',
      entityType: 'BrandingProfile',
      entityId: dto.institutionId,
    });
    return this.toDto(published);
  }

  async versions(auth: AuthContext, institutionId: string) {
    await this.assertInstitution(auth, institutionId);
    const published = await this.repo.findProfile(
      institutionId,
      auth.tenantId,
      'PUBLISHED',
    );
    if (!published) return [];
    return this.repo.listVersions(published.id);
  }

  async registerAssetMetadata(
    auth: AuthContext,
    params: {
      institutionId: string;
      assetType: string;
      contentType: string;
      body: Buffer;
      originalName?: string;
    },
  ) {
    await this.assertInstitution(auth, params.institutionId);
    if (!ALLOWED_MIME.has(params.contentType)) {
      throw new BadRequestException({
        code: 'BRANDING_ASSET_TYPE_INVALID',
        message: 'File type is not allowed.',
      });
    }
    if (params.body.length > MAX_BYTES) {
      throw new BadRequestException({
        code: 'BRANDING_ASSET_TOO_LARGE',
        message: 'File exceeds maximum size of 2MB.',
      });
    }
    const stored = await this.storage.putObject({
      tenantId: auth.tenantId,
      institutionId: params.institutionId,
      assetType: params.assetType,
      contentType: params.contentType,
      body: params.body,
      originalName: params.originalName,
    });
    const asset = await this.repo.createAsset({
      assetType: params.assetType,
      objectKey: stored.objectKey,
      contentType: params.contentType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      originalName: params.originalName,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: params.institutionId } },
    });
    return {
      id: asset.id,
      assetType: asset.assetType,
      deliveryUrl: stored.deliveryUrl,
      sizeBytes: asset.sizeBytes,
      storage: this.storage.isS3Configured() ? 's3' : 'local-dev-adapter',
      cdnConfigured: this.storage.isCdnConfigured(),
    };
  }

  private async assertInstitution(auth: AuthContext, institutionId: string) {
    const inst = await this.repo.findInstitutionForTenant(
      institutionId,
      auth.tenantId,
    );
    if (!inst) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_ACCESS_DENIED',
        message: 'Institution not found in your organization.',
      });
    }
    return inst;
  }

  private defaultTokens(): Record<string, string> {
    return {
      primary: '#0D1B3E',
      secondary: '#1D4ED8',
      accent: '#38BDF8',
      background: '#F1F5F9',
      foreground: '#0F172A',
      sidebar: '#0D1B3E',
      header: '#0D1B3E',
      buttonPrimary: '#1D4ED8',
      success: '#047857',
      warning: '#B45309',
      error: '#B91C1C',
      fontFamily: 'Inter, system-ui, sans-serif',
    };
  }

  private toDto(profile: {
    id: string;
    institutionId: string;
    tenantId: string;
    status: string;
    displayName: string | null;
    shortName: string | null;
    welcomeMessage: string | null;
    templateCode: string | null;
    tokensJson: unknown;
    version: number;
    publishedAt: Date | null;
  }) {
    return {
      id: profile.id,
      institutionId: profile.institutionId,
      tenantId: profile.tenantId,
      status: profile.status,
      displayName: profile.displayName,
      shortName: profile.shortName,
      welcomeMessage: profile.welcomeMessage,
      templateCode: profile.templateCode,
      tokens: profile.tokensJson as Record<string, string>,
      version: profile.version,
      publishedAt: profile.publishedAt?.toISOString() ?? null,
    };
  }
}
