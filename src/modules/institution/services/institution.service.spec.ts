import { ConflictException, NotFoundException } from '@nestjs/common';
import { InstitutionService } from './institution.service';

describe('InstitutionService', () => {
  const repo = {
    listByTenant: jest.fn(),
    findByIdForTenant: jest.fn(),
    findByCodeForTenant: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    metricsForInstitution: jest.fn().mockResolvedValue({
      students: 0,
      teachers: 0,
      applications: 0,
    }),
  };
  let service: InstitutionService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'admin@a.edu',
    personaType: 'STAFF',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InstitutionService(repo as never, { log: jest.fn() } as never);
  });

  it('lists only tenant institutions', async () => {
    repo.listByTenant.mockResolvedValue([
      {
        id: 'i1',
        tenantId: 'tenant-a',
        institutionCode: 'MAIN',
        name: 'Main',
        legalName: null,
        institutionType: 'SCHOOL',
        status: 'ACTIVE',
        email: null,
        phone: null,
        website: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        timezone: null,
        locale: null,
        currency: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const list = await service.list(auth);
    expect(repo.listByTenant).toHaveBeenCalledWith('tenant-a');
    expect(list[0].metrics.students).toBe(0);
  });

  it('rejects cross-tenant get', async () => {
    repo.findByIdForTenant.mockResolvedValue(null);
    await expect(service.getById(auth, 'other-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects duplicate code within tenant', async () => {
    repo.findByCodeForTenant.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create(auth, {
        institutionCode: 'MAIN',
        name: 'Dup',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates with auth tenantId only', async () => {
    repo.findByCodeForTenant.mockResolvedValue(null);
    repo.create.mockResolvedValue({
      id: 'i2',
      tenantId: 'tenant-a',
      institutionCode: 'NORTH',
      name: 'Northside',
      legalName: null,
      institutionType: null,
      status: 'ACTIVE',
      email: null,
      phone: null,
      website: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      timezone: null,
      locale: null,
      currency: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const created = await service.create(auth, {
      institutionCode: 'north',
      name: 'Northside',
    });
    expect(created.institutionCode).toBe('NORTH');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: { connect: { id: 'tenant-a' } },
      }),
    );
  });
});
