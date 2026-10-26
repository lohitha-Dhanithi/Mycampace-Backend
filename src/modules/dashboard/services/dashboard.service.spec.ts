import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const admissions = {
    metrics: jest.fn().mockResolvedValue({
      total: 2,
      byStatus: { SUBMITTED: 1, ACCEPTED: 1 },
    }),
  };
  const institutions = {
    listByTenant: jest.fn().mockResolvedValue([
      {
        id: 'i1',
        name: 'North',
        institutionCode: 'N',
        status: 'ACTIVE',
      },
    ]),
    findByIdForTenant: jest.fn(),
    metricsForInstitution: jest.fn().mockResolvedValue({
      students: 0,
      teachers: 0,
      applications: 2,
    }),
  };
  const authorization = {
    getSnapshot: jest.fn().mockResolvedValue({
      permissions: ['institution.read', 'admission.read', 'identity.user.read'],
    }),
  };
  const prisma = {
    user: { count: jest.fn().mockResolvedValue(3) },
    userCampusAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  let service: DashboardService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'e@x.com',
    personaType: 'STAFF',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(
      admissions as never,
      institutions as never,
      authorization as never,
      prisma as never,
    );
  });

  it('returns group-level summary with real admissions metrics', async () => {
    const summary = await service.getExecutiveSummary(auth);
    expect(summary.scope).toMatchObject({
      tenantId: 'tenant-a',
      level: 'GROUP',
    });
    expect((summary.applications as { total: number }).total).toBe(2);
    expect((summary.institutions as { total: number }).total).toBe(1);
    expect((summary.users as { totalActive: number }).totalActive).toBe(3);
    expect(summary.deferred).toBeDefined();
  });

  it('rejects cross-tenant institution filter', async () => {
    institutions.findByIdForTenant.mockResolvedValue(null);
    await expect(
      service.getExecutiveSummary(auth, 'foreign-inst'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('omits admissions when permission missing', async () => {
    authorization.getSnapshot.mockResolvedValue({
      permissions: ['institution.read'],
    });
    const summary = await service.getExecutiveSummary(auth);
    expect(summary.applications).toBeNull();
  });

  it('empty institutions yields total 0', async () => {
    institutions.listByTenant.mockResolvedValue([]);
    const summary = await service.getExecutiveSummary(auth);
    expect((summary.institutions as { total: number }).total).toBe(0);
  });
});
