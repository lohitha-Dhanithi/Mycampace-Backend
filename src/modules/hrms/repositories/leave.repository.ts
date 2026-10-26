import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus, Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

export const LEAVE_INCLUDE = {
  staff: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      reportingManagerId: true,
      department: { select: { id: true, name: true } },
    },
  },
  leaveType: { select: { id: true, code: true, name: true, deductsBalance: true } },
  currentApprover: { select: { id: true, fullName: true } },
  steps: { orderBy: { sequence: 'asc' } },
} satisfies Prisma.LeaveRequestInclude;

export type Tx = Prisma.TransactionClient;

@Injectable()
export class LeaveRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>, serializable = false) {
    return this.prisma.$transaction(fn, serializable ? { isolationLevel: 'Serializable' } : undefined);
  }

  activeAcademicYear(tenantId: string, institutionId: string) {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, institutionId, status: 'ACTIVE', deletedAt: null },
    });
  }

  findStaff(id: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        status: true,
        institutionId: true,
        reportingManagerId: true,
      },
    });
  }

  /** Used to walk the reporting chain one hop at a time. */
  findManagerOf(staffId: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: { id: staffId, tenantId, deletedAt: null },
      select: {
        reportingManager: { select: { id: true, fullName: true, status: true, deletedAt: true } },
      },
    });
  }

  leaveTypesWithDefaults(tenantId: string) {
    return this.prisma.leaveType.findMany({
      where: { tenantId, status: 'ACTIVE', defaultEntitlement: { not: null } },
    });
  }

  findLeaveType(id: string, tenantId: string) {
    return this.prisma.leaveType.findFirst({ where: { id, tenantId, status: 'ACTIVE' } });
  }

  createMissingBalances(rows: Prisma.LeaveBalanceCreateManyInput[]) {
    return this.prisma.leaveBalance.createMany({ data: rows, skipDuplicates: true });
  }

  balances(staffId: string, tenantId: string, academicYearId: string) {
    return this.prisma.leaveBalance.findMany({
      where: { staffId, tenantId, academicYearId },
      include: { leaveType: { select: { id: true, code: true, name: true } } },
      orderBy: { leaveType: { name: 'asc' } },
    });
  }

  list(
    tenantId: string,
    f: { status?: LeaveRequestStatus; staffId?: string; campusId?: string; page: number; pageSize: number },
  ) {
    const where: Prisma.LeaveRequestWhereInput = {
      tenantId,
      ...(f.status ? { status: f.status } : {}),
      ...(f.staffId ? { staffId: f.staffId } : {}),
      ...(f.campusId ? { staff: { campusId: f.campusId } } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        include: LEAVE_INCLUDE,
        orderBy: { appliedAt: 'desc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
  }

  inbox(approverStaffId: string, tenantId: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'PENDING_MANAGER',
        currentApproverId: approverStaffId,
        staffId: { not: approverStaffId },
      },
      include: LEAVE_INCLUDE,
      orderBy: { appliedAt: 'desc' },
    });
  }

  findById(id: string, tenantId: string) {
    return this.prisma.leaveRequest.findFirst({ where: { id, tenantId }, include: LEAVE_INCLUDE });
  }

  /** Open or approved requests that overlap the range (cancelled/rejected ignored). */
  overlapping(staffId: string, tenantId: string, from: Date, to: Date) {
    return this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        staffId,
        status: { in: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED'] },
        fromDate: { lte: to },
        toDate: { gte: from },
      },
      select: { id: true },
    });
  }
}
