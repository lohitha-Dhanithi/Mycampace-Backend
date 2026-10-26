import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';

describe('AcademicYearService', () => {
  const repo = {
    list: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findInstitution: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActiveExclusive: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let service: AcademicYearService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'a@x.com',
    personaType: 'STAFF',
  };

  const sample = {
    id: 'y1',
    tenantId: 'tenant-a',
    institutionId: 'inst-1',
    code: '2026-27',
    name: null,
    startDate: new Date('2026-06-01'),
    endDate: new Date('2027-03-31'),
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    institution: {
      name: 'EduCore International School',
      institutionCode: 'EIS',
      city: 'Hyderabad',
      state: 'Telangana',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AcademicYearService(repo as never, audit as never);
  });

  it('lists within tenant', async () => {
    repo.list.mockResolvedValue([sample]);
    const rows = await service.list(auth);
    expect(repo.list).toHaveBeenCalledWith('tenant-a', undefined);
    expect(rows[0].code).toBe('2026-27');
    expect(rows[0].location).toBe('Hyderabad, Telangana');
  });

  it('rejects create for institution outside tenant', async () => {
    repo.findInstitution.mockResolvedValue(null);
    await expect(
      service.create(auth, {
        institutionId: 'other',
        code: '2026-27',
        startDate: '2026-06-01',
        endDate: '2027-03-31',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid date range', async () => {
    repo.findInstitution.mockResolvedValue({ id: 'inst-1' });
    await expect(
      service.create(auth, {
        institutionId: 'inst-1',
        code: '2026-27',
        startDate: '2027-06-01',
        endDate: '2026-03-31',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate code', async () => {
    repo.findInstitution.mockResolvedValue({ id: 'inst-1' });
    repo.findByCode.mockResolvedValue(sample);
    await expect(
      service.create(auth, {
        institutionId: 'inst-1',
        code: '2026-27',
        startDate: '2026-06-01',
        endDate: '2027-03-31',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('get missing year', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.get(auth, 'missing')).rejects.toThrow(NotFoundException);
  });
});
