import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BrandingService } from './branding.service';

describe('BrandingService', () => {
  const repo = {
    listActiveTemplates: jest.fn(),
    findTemplateByCode: jest.fn(),
    findInstitutionForTenant: jest.fn(),
    findInstitutionById: jest.fn(),
    findProfile: jest.fn(),
    upsertDraft: jest.fn(),
    publish: jest.fn(),
    listVersions: jest.fn(),
    createAsset: jest.fn(),
  };
  const storage = {
    putObject: jest.fn(),
    isS3Configured: jest.fn().mockReturnValue(false),
    isCdnConfigured: jest.fn().mockReturnValue(false),
  };
  let service: BrandingService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'a@x.com',
    personaType: 'STAFF',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrandingService(repo as never, storage as never, { log: jest.fn() } as never);
  });

  it('lists templates from repository', async () => {
    repo.listActiveTemplates.mockResolvedValue([
      { code: 'EDUCORE_CLASSIC', name: 'Classic' },
    ]);
    const t = await service.listTemplates();
    expect(t[0].code).toBe('EDUCORE_CLASSIC');
  });

  it('denies cross-tenant institution', async () => {
    repo.findInstitutionForTenant.mockResolvedValue(null);
    await expect(
      service.applyTemplate(auth, {
        institutionId: 'inst-b',
        templateCode: 'EDUCORE_CLASSIC',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('applies template into draft', async () => {
    repo.findInstitutionForTenant.mockResolvedValue({ id: 'i1' });
    repo.findTemplateByCode.mockResolvedValue({
      code: 'EDUCORE_CLASSIC',
      tokensJson: { primary: '#0D1B3E' },
    });
    repo.upsertDraft.mockResolvedValue({
      id: 'bp1',
      institutionId: 'i1',
      tenantId: 'tenant-a',
      status: 'DRAFT',
      displayName: null,
      shortName: null,
      welcomeMessage: null,
      templateCode: 'EDUCORE_CLASSIC',
      tokensJson: { primary: '#0D1B3E' },
      version: 1,
      publishedAt: null,
    });
    const draft = await service.applyTemplate(auth, {
      institutionId: 'i1',
      templateCode: 'EDUCORE_CLASSIC',
    });
    expect(draft.status).toBe('DRAFT');
    expect(draft.templateCode).toBe('EDUCORE_CLASSIC');
  });

  it('rejects invalid template', async () => {
    repo.findInstitutionForTenant.mockResolvedValue({ id: 'i1' });
    repo.findTemplateByCode.mockResolvedValue(null);
    await expect(
      service.applyTemplate(auth, {
        institutionId: 'i1',
        templateCode: 'NOPE',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('falls back tokens when no published branding', async () => {
    repo.findInstitutionById.mockResolvedValue({
      id: 'i1',
      tenantId: 'tenant-a',
    });
    repo.findProfile.mockResolvedValue(null);
    const runtime = await service.getPublishedByInstitution('i1');
    expect(runtime.status).toBe('FALLBACK');
    expect(runtime.tokens.primary).toBe('#0D1B3E');
  });
});
