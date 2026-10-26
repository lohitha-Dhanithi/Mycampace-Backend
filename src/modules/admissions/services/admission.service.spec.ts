import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdmissionService } from './admission.service';

describe('AdmissionService', () => {
  const repo = {
    list: jest.fn(),
    findById: jest.fn(),
    findInstitution: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    nextApplicationNo: jest.fn().mockResolvedValue('APP-2026-00001'),
    countByStatus: jest.fn().mockResolvedValue([]),
    findByApplicant: jest.fn().mockResolvedValue([]),
    findByIdForApplicant: jest.fn(),
  };
  let service: AdmissionService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'reg@a.edu',
    personaType: 'STAFF',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdmissionService(repo as never, { log: jest.fn() } as never);
  });

  it('lists within tenant only', async () => {
    repo.list.mockResolvedValue([]);
    await service.list(auth);
    expect(repo.list).toHaveBeenCalledWith('tenant-a', undefined);
  });

  it('rejects institution outside tenant', async () => {
    repo.findInstitution.mockResolvedValue(null);
    await expect(
      service.create(auth, {
        institutionId: 'other',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates application with generated number', async () => {
    repo.findInstitution.mockResolvedValue({ id: 'inst-1' });
    repo.create.mockResolvedValue({
      id: 'app-1',
      tenantId: 'tenant-a',
      institutionId: 'inst-1',
      applicationNo: 'APP-2026-00001',
      status: 'SUBMITTED',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@x.com',
      phone: null,
      dateOfBirth: null,
      programApplied: 'Science',
      academicYear: '2026-27',
      notes: null,
      submittedAt: new Date(),
      reviewedAt: null,
      decidedAt: null,
      decidedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      institution: { id: 'inst-1', name: 'North', institutionCode: 'NORTH' },
    });
    const created = await service.create(auth, {
      institutionId: 'inst-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@x.com',
      programApplied: 'Science',
      academicYear: '2026-27',
    });
    expect(created.applicationNo).toBe('APP-2026-00001');
    expect(created.status).toBe('SUBMITTED');
  });

  it('get missing is not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.get(auth, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('metrics returns zeros when empty', async () => {
    const m = await service.metrics(auth);
    expect(m.total).toBe(0);
    expect(m.byStatus.SUBMITTED).toBe(0);
  });

  describe('applicant portal', () => {
    beforeEach(() => {
      repo.findByApplicant = jest.fn().mockResolvedValue([]);
      repo.findByIdForApplicant = jest.fn();
    });

    it('listMine uses applicant user id', async () => {
      await service.listMine(auth);
      expect(repo.findByApplicant).toHaveBeenCalledWith('u1', 'tenant-a');
    });

    it('getMine not found for other applicant', async () => {
      repo.findByIdForApplicant.mockResolvedValue(null);
      await expect(service.getMine(auth, 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createMine binds applicant user', async () => {
      repo.findInstitution.mockResolvedValue({ id: 'inst-1' });
      repo.create.mockResolvedValue({
        id: 'app-1',
        tenantId: 'tenant-a',
        institutionId: 'inst-1',
        applicationNo: 'APP-2026-00001',
        status: 'SUBMITTED',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@x.com',
        phone: null,
        dateOfBirth: null,
        programApplied: null,
        academicYear: null,
        notes: null,
        submittedAt: new Date(),
        reviewedAt: null,
        decidedAt: null,
        decidedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await service.createMine(auth, {
        institutionId: 'inst-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@x.com',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          applicant: { connect: { id: 'u1' } },
        }),
      );
    });
  });
});
