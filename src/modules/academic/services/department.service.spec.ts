import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DepartmentService } from './department.service';

describe('DepartmentService', () => {
  const repo = {
    list: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    findInstitution: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softArchive: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let service: DepartmentService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'a@x.com',
    personaType: 'STAFF',
  };

  const sample = {
    id: 'd1',
    tenantId: 'tenant-a',
    institutionId: 'inst-1',
    code: 'CS',
    name: 'Computer Science',
    description: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    institution: { name: 'EduCore International School', institutionCode: 'EIS' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DepartmentService(repo as never, audit as never);
  });

  it('lists within tenant', async () => {
    repo.list.mockResolvedValue([sample]);
    const rows = await service.list(auth);
    expect(repo.list).toHaveBeenCalledWith('tenant-a', undefined);
    expect(rows[0].code).toBe('CS');
    expect(rows[0].programs).toEqual([]);
  });

  it('rejects create for institution outside tenant', async () => {
    repo.findInstitution.mockResolvedValue(null);
    await expect(
      service.create(auth, {
        institutionId: 'other',
        code: 'CS',
        name: 'Computer Science',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects duplicate code', async () => {
    repo.findInstitution.mockResolvedValue({ id: 'inst-1' });
    repo.findByCode.mockResolvedValue(sample);
    await expect(
      service.create(auth, {
        institutionId: 'inst-1',
        code: 'CS',
        name: 'Computer Science',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates department', async () => {
    repo.findInstitution.mockResolvedValue({ id: 'inst-1' });
    repo.findByCode.mockResolvedValue(null);
    repo.create.mockResolvedValue(sample);
    const row = await service.create(auth, {
      institutionId: 'inst-1',
      code: 'cs',
      name: 'Computer Science',
    });
    expect(row.code).toBe('CS');
    expect(audit.log).toHaveBeenCalled();
  });

  it('get missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.get(auth, 'x')).rejects.toThrow(NotFoundException);
  });

  it('archives department', async () => {
    repo.findById.mockResolvedValue(sample);
    repo.softArchive.mockResolvedValue({ count: 1 });
    const res = await service.archive(auth, 'd1');
    expect(res.message).toContain('archived');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'department.archive' }),
    );
  });
});
