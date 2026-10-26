import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveActionDto } from '../dto/leave.dto';

const auth = { userId: 'u1', tenantId: 't1', email: 'a@x.com', personaType: 'STAFF' };

/** Reporting chain: emp -> mgr -> head -> (none). */
function build(opts: { chain?: Record<string, any>; overlap?: boolean; year?: boolean } = {}) {
  const chain: Record<string, any> = opts.chain ?? {
    emp: { reportingManager: { id: 'mgr', fullName: 'Manager', status: 'ACTIVE', deletedAt: null } },
    mgr: { reportingManager: { id: 'head', fullName: 'Head', status: 'ACTIVE', deletedAt: null } },
    head: { reportingManager: null },
  };
  const created: any[] = [];
  const repo: any = {
    findStaff: jest.fn(async (id: string) => ({ id, fullName: id, status: 'ACTIVE', institutionId: 'i1' })),
    findLeaveType: jest.fn(async () => ({ id: 'lt', name: 'Casual Leave' })),
    activeAcademicYear: jest.fn(async () => (opts.year === false ? null : { id: 'ay' })),
    leaveTypesWithDefaults: jest.fn(async () => []),
    createMissingBalances: jest.fn(),
    overlapping: jest.fn(async () => (opts.overlap ? { id: 'x' } : null)),
    findManagerOf: jest.fn(async (id: string) => chain[id] ?? { reportingManager: null }),
    transaction: jest.fn(async (fn: any) =>
      fn({
        leaveRequest: {
          create: jest.fn(async ({ data }: any) => {
            created.push(data);
            return {
              id: 'lv1', ...data, days: data.days, fromDate: data.fromDate, toDate: data.toDate,
              appliedAt: new Date(), decidedAt: null, staff: { fullName: 'emp', employeeCode: 'EMP-1', department: { name: 'Physics' } },
              leaveType: { id: 'lt', code: 'C', name: 'Casual Leave' }, currentApprover: null, steps: [],
            };
          }),
        },
      }),
    ),
  };
  const staffRepo: any = { findByUser: jest.fn(async () => ({ id: 'emp', fullName: 'emp' })) };
  const audit: any = { log: jest.fn() };
  const authz: any = { hasPermission: jest.fn(async () => true) };
  return { svc: new LeaveService(repo, staffRepo, audit, authz), repo, staffRepo, created };
}

const dto = { leaveTypeId: 'lt', fromDate: '2026-10-20', toDate: '2026-10-22', reason: 'Family function' };

describe('LeaveService.create', () => {
  it('routes to the first reporting manager and counts inclusive days', async () => {
    const { svc, created } = build();
    await svc.createMine(auth, dto);
    expect(created[0]).toMatchObject({ status: 'PENDING_MANAGER', currentApproverId: 'mgr', days: 3 });
  });

  it('goes straight to HR when there is no reporting manager', async () => {
    const { svc, created } = build({ chain: { emp: { reportingManager: null } } });
    await svc.createMine(auth, dto);
    expect(created[0]).toMatchObject({ status: 'PENDING_HR', currentApproverId: null });
  });

  it('skips a separated manager and uses the next one up', async () => {
    const { svc, created } = build({
      chain: {
        emp: { reportingManager: { id: 'mgr', fullName: 'M', status: 'SEPARATED', deletedAt: null } },
        mgr: { reportingManager: { id: 'head', fullName: 'Head', status: 'ACTIVE', deletedAt: null } },
      },
    });
    await svc.createMine(auth, dto);
    expect(created[0].currentApproverId).toBe('head');
  });

  it('does not loop forever on a circular reporting chain', async () => {
    const { svc, created } = build({
      chain: {
        emp: { reportingManager: { id: 'a', fullName: 'A', status: 'SEPARATED', deletedAt: null } },
        a: { reportingManager: { id: 'emp', fullName: 'Emp', status: 'ACTIVE', deletedAt: null } },
      },
    });
    await svc.createMine(auth, dto);
    expect(created[0].status).toBe('PENDING_HR');
  });

  it('rejects an inverted date range', async () => {
    const { svc } = build();
    await expect(svc.createMine(auth, { ...dto, fromDate: '2026-10-22', toDate: '2026-10-20' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects overlapping leave', async () => {
    const { svc } = build({ overlap: true });
    await expect(svc.createMine(auth, dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires an active academic year', async () => {
    const { svc } = build({ year: false });
    await expect(svc.createMine(auth, dto)).rejects.toMatchObject({ response: { code: 'HRMS_NO_ACTIVE_ACADEMIC_YEAR' } });
  });
});

describe('LeaveService.decideAsManager', () => {
  function withLeave(leave: any) {
    const ctx = build();
    ctx.repo.transaction = jest.fn(async (fn: any) =>
      fn({
        leaveRequest: { findFirst: jest.fn(async () => leave), update: jest.fn(), findFirstOrThrow: jest.fn(async () => ({ ...leave, appliedAt: new Date(), decidedAt: null, fromDate: new Date(), toDate: new Date(), days: 1, staff: { fullName: 'x', employeeCode: 'E', department: { name: 'D' } }, leaveType: { id: 'lt', code: 'C', name: 'C' }, currentApprover: null, steps: [] })) },
        leaveApprovalStep: { count: jest.fn(async () => 1), create: jest.fn() },
      }),
    );
    return ctx;
  }

  it('blocks approving your own leave', async () => {
    const { svc } = withLeave({ id: 'lv', staffId: 'emp', status: 'PENDING_MANAGER', currentApproverId: 'emp' });
    await expect(svc.decideAsManager(auth, 'lv', { action: LeaveActionDto.APPROVE })).rejects.toMatchObject({
      response: { code: 'HRMS_SELF_APPROVAL' },
    });
  });

  it('blocks a manager who is not the assigned approver', async () => {
    const { svc } = withLeave({ id: 'lv', staffId: 'other', status: 'PENDING_MANAGER', currentApproverId: 'someone-else' });
    await expect(svc.decideAsManager(auth, 'lv', { action: LeaveActionDto.APPROVE })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
