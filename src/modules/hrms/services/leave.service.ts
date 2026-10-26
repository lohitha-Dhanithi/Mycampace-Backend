import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestStatus, Prisma } from '../../../generated/prisma-client';
import { LeaveRepository, LEAVE_INCLUDE } from '../repositories/leave.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { AuditService } from '../../audit/services/audit.service';
import { AuthorizationService } from '../../identity/services/authorization.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { CreateLeaveDto, CreateLeaveForStaffDto, DecideLeaveDto, LeaveActionDto } from '../dto/leave.dto';
import { inclusiveDays, isoDate, parseDate, todayUtc } from '../common/hrms.util';

type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof LEAVE_INCLUDE }>;

const MAX_CHAIN_HOPS = 50;

@Injectable()
export class LeaveService {
  constructor(
    private readonly repo: LeaveRepository,
    private readonly staffRepo: StaffRepository,
    private readonly audit: AuditService,
    private readonly authz: AuthorizationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Balances
  // ---------------------------------------------------------------------------

  /**
   * Make sure the staff member has a balance row for every leave type that carries a default
   * entitlement, for the institution's active academic year. Returns that year's id, or null
   * when no academic year is active.
   */
  async ensureBalances(tenantId: string, staff: { id: string; institutionId: string }) {
    const year = await this.repo.activeAcademicYear(tenantId, staff.institutionId);
    if (!year) return null;
    const types = await this.repo.leaveTypesWithDefaults(tenantId);
    if (types.length) {
      await this.repo.createMissingBalances(
        types.map((t) => ({
          tenantId,
          staffId: staff.id,
          leaveTypeId: t.id,
          academicYearId: year.id,
          entitled: t.defaultEntitlement as Prisma.Decimal,
        })),
      );
    }
    return year.id;
  }

  async balancesFor(auth: AuthContext, staffId: string) {
    const staff = await this.repo.findStaff(staffId, auth.tenantId);
    if (!staff) throw this.staffNotFound();
    const yearId = await this.ensureBalances(auth.tenantId, staff);
    if (!yearId) return [];
    const rows = await this.repo.balances(staffId, auth.tenantId, yearId);
    return rows.map((b) => ({
      leaveTypeId: b.leaveTypeId,
      type: b.leaveType.name,
      code: b.leaveType.code,
      entitled: Number(b.entitled),
      used: Number(b.used),
      remaining: Number(b.entitled) - Number(b.used),
    }));
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async list(
    auth: AuthContext,
    q: { status?: LeaveRequestStatus; staffId?: string; campusId?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const [rows, total] = await this.repo.list(auth.tenantId, { ...q, page, pageSize });
    return { items: rows.map((r) => this.toDto(r)), total, page, pageSize };
  }

  async listMine(auth: AuthContext) {
    const me = await this.requireMe(auth);
    const [rows] = await this.repo.list(auth.tenantId, { staffId: me.id, page: 1, pageSize: 100 });
    return rows.map((r) => this.toDto(r));
  }

  async inbox(auth: AuthContext) {
    const me = await this.requireMe(auth);
    const rows = await this.repo.inbox(me.id, auth.tenantId);
    return rows.map((r) => this.toDto(r));
  }

  async get(auth: AuthContext, id: string) {
    const row = await this.findOrThrow(auth.tenantId, id);
    if (!(await this.authz.hasPermission(auth.userId, auth.tenantId, 'hrms.leave.read'))) {
      const me = await this.requireMe(auth);
      const involved =
        row.staffId === me.id ||
        row.currentApproverId === me.id ||
        row.steps.some((s) => s.actorStaffId === me.id);
      if (!involved) throw this.denied();
    }
    return {
      ...this.toDto(row),
      balances: await this.balancesFor(auth, row.staffId),
    };
  }

  /** Who would receive a new request from this staff member (apply-form preview). */
  async previewFirstApprover(auth: AuthContext, staffId: string) {
    if (!(await this.repo.findStaff(staffId, auth.tenantId))) throw this.staffNotFound();
    const manager = await this.nextManager(auth.tenantId, staffId, staffId);
    return manager ? { kind: 'MANAGER', staffId: manager.id, name: manager.fullName } : { kind: 'HR', name: 'HR' };
  }

  // ---------------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------------

  async createMine(auth: AuthContext, dto: CreateLeaveDto) {
    const me = await this.requireMe(auth);
    return this.create(auth, me.id, dto);
  }

  async createForStaff(auth: AuthContext, dto: CreateLeaveForStaffDto) {
    return this.create(auth, dto.staffId, dto);
  }

  private async create(auth: AuthContext, staffId: string, dto: CreateLeaveDto) {
    const staff = await this.repo.findStaff(staffId, auth.tenantId);
    if (!staff) throw this.staffNotFound();
    if (staff.status === 'SEPARATED') {
      throw new BadRequestException({ code: 'HRMS_STAFF_SEPARATED', message: 'Separated staff cannot apply for leave.' });
    }
    const type = await this.repo.findLeaveType(dto.leaveTypeId, auth.tenantId);
    if (!type) {
      throw new BadRequestException({ code: 'HRMS_LEAVE_TYPE_NOT_FOUND', message: 'Leave type not found or inactive.' });
    }
    const from = parseDate(dto.fromDate);
    const to = parseDate(dto.toDate);
    const days = inclusiveDays(from, to);
    if (days <= 0) {
      throw new BadRequestException({ code: 'HRMS_LEAVE_RANGE_INVALID', message: 'Choose a valid date range.' });
    }
    const yearId = await this.ensureBalances(auth.tenantId, staff);
    if (!yearId) {
      throw new BadRequestException({
        code: 'HRMS_NO_ACTIVE_ACADEMIC_YEAR',
        message: 'No active academic year is configured for this institution.',
      });
    }
    if (await this.repo.overlapping(staffId, auth.tenantId, from, to)) {
      throw new ConflictException({
        code: 'HRMS_LEAVE_OVERLAP',
        message: 'You already have a pending or approved leave that overlaps these dates.',
      });
    }

    const manager = await this.nextManager(auth.tenantId, staffId, staffId);
    const created = await this.repo.transaction((tx) =>
      tx.leaveRequest.create({
        data: {
          tenantId: auth.tenantId,
          staffId,
          leaveTypeId: type.id,
          academicYearId: yearId,
          fromDate: from,
          toDate: to,
          days,
          reason: dto.reason.trim(),
          status: manager ? 'PENDING_MANAGER' : 'PENDING_HR',
          currentApproverId: manager?.id ?? null,
          steps: {
            create: {
              tenantId: auth.tenantId,
              sequence: 1,
              approverKind: 'APPLICANT',
              actorStaffId: staffId,
              actorUserId: auth.userId,
              actorName: staff.fullName,
              decision: 'SUBMITTED',
              comment: dto.reason.trim(),
            },
          },
        },
        include: LEAVE_INCLUDE,
      }),
    );
    await this.log(auth, 'hrms.leave.create', created.id, { staffId, days });
    return this.toDto(created);
  }

  // ---------------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------------

  /** Reporting-chain approver acts on a request assigned to them. */
  async decideAsManager(auth: AuthContext, id: string, dto: DecideLeaveDto) {
    const me = await this.requireMe(auth);
    const comment = this.commentFor(dto);

    const updated = await this.repo.transaction(async (tx) => {
      const leave = await tx.leaveRequest.findFirst({ where: { id, tenantId: auth.tenantId } });
      if (!leave) throw this.notFound();
      if (leave.staffId === me.id) {
        throw new ForbiddenException({ code: 'HRMS_SELF_APPROVAL', message: 'You cannot approve your own leave.' });
      }
      if (leave.status !== 'PENDING_MANAGER' || leave.currentApproverId !== me.id) {
        throw new ForbiddenException({ code: 'HRMS_NOT_ASSIGNED', message: 'This request is not assigned to you.' });
      }
      const seq = (await tx.leaveApprovalStep.count({ where: { leaveRequestId: id } })) + 1;
      const step = {
        tenantId: auth.tenantId,
        leaveRequestId: id,
        sequence: seq,
        approverKind: 'MANAGER' as const,
        actorStaffId: me.id,
        actorUserId: auth.userId,
        actorName: me.fullName,
        comment,
      };

      if (dto.action === LeaveActionDto.REJECT) {
        await tx.leaveApprovalStep.create({ data: { ...step, decision: 'REJECTED' } });
        await tx.leaveRequest.update({
          where: { id },
          data: { status: 'REJECTED', currentApproverId: null, decidedAt: new Date() },
        });
      } else {
        await tx.leaveApprovalStep.create({ data: { ...step, decision: 'APPROVED' } });
        const next = await this.nextManager(auth.tenantId, me.id, leave.staffId);
        await tx.leaveRequest.update({
          where: { id },
          data: next
            ? { status: 'PENDING_MANAGER', currentApproverId: next.id }
            : { status: 'PENDING_HR', currentApproverId: null },
        });
      }
      return tx.leaveRequest.findFirstOrThrow({ where: { id }, include: LEAVE_INCLUDE });
    });

    await this.log(auth, `hrms.leave.manager_${dto.action.toLowerCase()}`, id);
    return this.toDto(updated);
  }

  /** Final HR decision. Approval deducts balance and syncs attendance in one transaction. */
  async decideAsHr(auth: AuthContext, id: string, dto: DecideLeaveDto) {
    const me = await this.staffRepo.findByUser(auth.userId, auth.email, auth.tenantId);
    const comment = this.commentFor(dto);
    const actorName = me?.fullName ?? 'HR Administrator';

    const updated = await this.repo.transaction(async (tx) => {
      const leave = await tx.leaveRequest.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { leaveType: true },
      });
      if (!leave) throw this.notFound();
      if (me && leave.staffId === me.id) {
        throw new ForbiddenException({ code: 'HRMS_SELF_APPROVAL', message: 'You cannot approve your own leave.' });
      }
      if (leave.status !== 'PENDING_HR') {
        throw new BadRequestException({
          code: 'HRMS_NOT_PENDING_HR',
          message: 'HR can decide only after the reporting chain has approved.',
        });
      }
      const seq = (await tx.leaveApprovalStep.count({ where: { leaveRequestId: id } })) + 1;
      const step = {
        tenantId: auth.tenantId,
        leaveRequestId: id,
        sequence: seq,
        approverKind: 'HR' as const,
        actorStaffId: me?.id ?? null,
        actorUserId: auth.userId,
        actorName,
        comment,
      };

      if (dto.action === LeaveActionDto.REJECT) {
        await tx.leaveApprovalStep.create({ data: { ...step, decision: 'REJECTED' } });
        await tx.leaveRequest.update({ where: { id }, data: { status: 'REJECTED', currentApproverId: null, decidedAt: new Date() } });
      } else {
        let deducted = false;
        if (leave.leaveType.deductsBalance) {
          const balance = await tx.leaveBalance.findFirst({
            where: { staffId: leave.staffId, leaveTypeId: leave.leaveTypeId, academicYearId: leave.academicYearId },
          });
          if (!balance) {
            throw new BadRequestException({
              code: 'HRMS_NO_BALANCE',
              message: `No ${leave.leaveType.name} balance is configured for this staff member.`,
            });
          }
          const remaining = Number(balance.entitled) - Number(balance.used);
          if (Number(leave.days) > remaining) {
            throw new BadRequestException({
              code: 'HRMS_INSUFFICIENT_BALANCE',
              message: `Not enough ${leave.leaveType.name} balance. ${remaining} day(s) remaining.`,
            });
          }
          await tx.leaveBalance.update({ where: { id: balance.id }, data: { used: { increment: leave.days } } });
          deducted = true;
        }
        await tx.leaveApprovalStep.create({ data: { ...step, decision: 'APPROVED' } });
        await tx.leaveRequest.update({
          where: { id },
          data: { status: 'APPROVED', currentApproverId: null, decidedAt: new Date(), balanceDeducted: deducted },
        });
        // Reflect the leave in the attendance register for days already generated
        await tx.attendanceRecord.updateMany({
          where: { tenantId: auth.tenantId, staffId: leave.staffId, attendanceDate: { gte: leave.fromDate, lte: leave.toDate } },
          data: { status: 'ON_LEAVE', leaveRequestId: id, source: 'LEAVE_SYNC' },
        });
        const today = todayUtc();
        if (leave.fromDate <= today && leave.toDate >= today) {
          await tx.staff.updateMany({ where: { id: leave.staffId, status: 'ACTIVE' }, data: { status: 'ON_LEAVE' } });
        }
      }
      return tx.leaveRequest.findFirstOrThrow({ where: { id }, include: LEAVE_INCLUDE });
    }, true);

    await this.log(auth, `hrms.leave.hr_${dto.action.toLowerCase()}`, id);
    return this.toDto(updated);
  }

  /** Applicant withdraws a request that has not started. Restores any deducted balance. */
  async cancelMine(auth: AuthContext, id: string, comment?: string) {
    const me = await this.requireMe(auth);
    const updated = await this.repo.transaction(async (tx) => {
      const leave = await tx.leaveRequest.findFirst({ where: { id, tenantId: auth.tenantId } });
      if (!leave) throw this.notFound();
      if (leave.staffId !== me.id) throw this.denied();
      if (!['PENDING_MANAGER', 'PENDING_HR', 'APPROVED'].includes(leave.status)) {
        throw new BadRequestException({ code: 'HRMS_LEAVE_CLOSED', message: 'This request is already closed.' });
      }
      if (leave.status === 'APPROVED' && leave.fromDate <= todayUtc()) {
        throw new BadRequestException({
          code: 'HRMS_LEAVE_STARTED',
          message: 'Leave that has already started cannot be cancelled. Contact HR.',
        });
      }
      if (leave.balanceDeducted) {
        await tx.leaveBalance.updateMany({
          where: { staffId: leave.staffId, leaveTypeId: leave.leaveTypeId, academicYearId: leave.academicYearId },
          data: { used: { decrement: leave.days } },
        });
        await tx.attendanceRecord.updateMany({
          where: { leaveRequestId: id },
          data: { status: 'ABSENT', leaveRequestId: null, source: 'LEAVE_SYNC' },
        });
      }
      const seq = (await tx.leaveApprovalStep.count({ where: { leaveRequestId: id } })) + 1;
      await tx.leaveApprovalStep.create({
        data: {
          tenantId: auth.tenantId,
          leaveRequestId: id,
          sequence: seq,
          approverKind: 'APPLICANT',
          actorStaffId: me.id,
          actorUserId: auth.userId,
          actorName: me.fullName,
          decision: 'CANCELLED',
          comment: comment?.trim() || 'Cancelled by applicant.',
        },
      });
      await tx.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED', currentApproverId: null, decidedAt: new Date(), balanceDeducted: false },
      });
      return tx.leaveRequest.findFirstOrThrow({ where: { id }, include: LEAVE_INCLUDE });
    });
    await this.log(auth, 'hrms.leave.cancel', id);
    return this.toDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Walk up the reporting chain from `startId` and return the first active manager who is not the
   * applicant. Returns null (→ HR queue) when the chain ends, loops, or has no eligible manager.
   */
  private async nextManager(tenantId: string, startId: string, applicantId: string) {
    const seen = new Set<string>([startId]);
    let cursor = startId;
    for (let hop = 0; hop < MAX_CHAIN_HOPS; hop += 1) {
      const row = await this.repo.findManagerOf(cursor, tenantId);
      const manager = row?.reportingManager;
      if (!manager || manager.deletedAt || seen.has(manager.id)) return null;
      seen.add(manager.id);
      if (manager.id !== applicantId && manager.status !== 'SEPARATED') return manager;
      cursor = manager.id;
    }
    return null;
  }

  private async requireMe(auth: AuthContext) {
    const me = await this.staffRepo.findByUser(auth.userId, auth.email, auth.tenantId);
    if (!me) {
      throw new NotFoundException({
        code: 'HRMS_NO_STAFF_RECORD',
        message: 'No staff record is linked to your account. Contact HR.',
      });
    }
    return me;
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.repo.findById(id, tenantId);
    if (!row) throw this.notFound();
    return row;
  }

  private commentFor(dto: DecideLeaveDto) {
    return dto.comment?.trim() || (dto.action === LeaveActionDto.APPROVE ? 'Approved.' : 'Rejected.');
  }

  private notFound() {
    return new NotFoundException({ code: 'HRMS_LEAVE_NOT_FOUND', message: 'Leave request not found.' });
  }
  private staffNotFound() {
    return new NotFoundException({ code: 'HRMS_STAFF_NOT_FOUND', message: 'Staff record not found.' });
  }
  private denied() {
    return new ForbiddenException({ code: 'HRMS_LEAVE_ACCESS_DENIED', message: 'You do not have access to this leave request.' });
  }

  private log(auth: AuthContext, action: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action,
      module: 'hrms',
      entityType: 'LeaveRequest',
      entityId,
      metadata,
    });
  }

  private toDto(r: LeaveRow) {
    return {
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff.fullName,
      employeeCode: r.staff.employeeCode,
      department: r.staff.department.name,
      leaveType: { id: r.leaveType.id, code: r.leaveType.code, name: r.leaveType.name },
      fromDate: isoDate(r.fromDate),
      toDate: isoDate(r.toDate),
      days: Number(r.days),
      reason: r.reason,
      status: r.status,
      appliedOn: r.appliedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      currentApprover: r.currentApprover ? { id: r.currentApprover.id, name: r.currentApprover.fullName } : null,
      awaiting:
        r.status === 'PENDING_HR' ? 'HR' : r.status === 'PENDING_MANAGER' ? (r.currentApprover?.fullName ?? 'Reporting manager') : null,
      timeline: r.steps.map((s) => ({
        sequence: s.sequence,
        step: s.approverKind === 'HR' ? 'HR Administrator' : s.actorName,
        actor: s.actorName,
        decision: s.decision,
        comment: s.comment,
        at: s.actedAt.toISOString(),
      })),
    };
  }
}
