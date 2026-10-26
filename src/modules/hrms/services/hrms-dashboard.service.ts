import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { isoDate, todayUtc } from '../common/hrms.util';

const EXPIRY_WINDOW_DAYS = 60;

@Injectable()
export class HrmsDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aggregates for the HR dashboard. All counts are tenant-scoped; optional campus filter. */
  async get(auth: AuthContext, campusId?: string) {
    const tenantId = auth.tenantId;
    const today = todayUtc();
    const horizon = new Date(today.getTime() + EXPIRY_WINDOW_DAYS * 86_400_000);
    const staffWhere = { tenantId, deletedAt: null, status: { not: 'SEPARATED' as const }, ...(campusId ? { campusId } : {}) };
    const staffScope = campusId ? { staff: { campusId } } : {};

    const [
      byCategory,
      byDepartment,
      pendingLeaves,
      leaveQueue,
      appraisalsByStage,
      attendanceToday,
      expiringDocs,
      expiringCerts,
      ratings,
    ] = await Promise.all([
      this.prisma.staff.groupBy({ by: ['categoryId'], where: staffWhere, _count: { _all: true } }),
      this.prisma.staff.groupBy({ by: ['departmentId'], where: staffWhere, _count: { _all: true } }),
      this.prisma.leaveRequest.count({
        where: { tenantId, status: { in: ['PENDING_MANAGER', 'PENDING_HR'] }, ...staffScope },
      }),
      this.prisma.leaveRequest.findMany({
        where: { tenantId, status: { in: ['PENDING_MANAGER', 'PENDING_HR'] }, ...staffScope },
        include: {
          staff: { select: { fullName: true, department: { select: { name: true } } } },
          leaveType: { select: { name: true } },
          currentApprover: { select: { fullName: true } },
        },
        orderBy: { appliedAt: 'asc' },
        take: 8,
      }),
      this.prisma.appraisalReview.groupBy({
        by: ['stage'],
        where: { tenantId, cycle: { isOpen: true }, ...staffScope },
        _count: { _all: true },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { tenantId, attendanceDate: today, ...(campusId ? { campusId } : {}) },
        _count: { _all: true },
      }),
      this.prisma.staffDocument.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...staffScope,
          OR: [{ status: 'EXPIRED' }, { status: 'PENDING_REVIEW' }, { expiryDate: { lte: horizon } }],
        },
        include: { staff: { select: { fullName: true } } },
        orderBy: { expiryDate: 'asc' },
        take: 10,
      }),
      this.prisma.certification.findMany({
        where: { tenantId, deletedAt: null, ...staffScope, validUntil: { lte: horizon } },
        include: { staff: { select: { fullName: true } } },
        orderBy: { validUntil: 'asc' },
        take: 10,
      }),
      this.prisma.appraisalReview.groupBy({
        by: ['finalRating'],
        where: { tenantId, finalRating: { not: null }, ...staffScope },
        _count: { _all: true },
      }),
    ]);

    const [categories, departments] = await Promise.all([
      this.prisma.hrmsCategory.findMany({ where: { tenantId }, select: { id: true, name: true, isTeaching: true } }),
      this.prisma.hrmsDepartment.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    ]);
    const catById = new Map(categories.map((c) => [c.id, c]));
    const deptById = new Map(departments.map((d) => [d.id, d.name]));

    const totalStaff = byCategory.reduce((s, r) => s + r._count._all, 0);
    const teaching = byCategory
      .filter((r) => catById.get(r.categoryId)?.isTeaching)
      .reduce((s, r) => s + r._count._all, 0);
    const att = Object.fromEntries(attendanceToday.map((r) => [r.status, r._count._all])) as Record<string, number>;
    const stageCount = (stage: string) => appraisalsByStage.find((r) => r.stage === stage)?._count._all ?? 0;
    const closed = stageCount('HR_CLOSED');
    const appraisalsTotal = appraisalsByStage.reduce((s, r) => s + r._count._all, 0);

    const expiringItems = [
      ...expiringDocs.map((d) => ({
        id: d.id,
        kind: 'Document',
        label: d.name,
        owner: d.staff.fullName,
        detail:
          d.status === 'EXPIRED' || (d.expiryDate && d.expiryDate < today)
            ? 'Document expired'
            : d.status === 'PENDING_REVIEW'
              ? 'Awaiting vault verification'
              : `Expires ${isoDate(d.expiryDate)}`,
        date: isoDate(d.expiryDate),
      })),
      ...expiringCerts.map((c) => ({
        id: c.id,
        kind: 'Certification',
        label: c.name,
        owner: c.staff.fullName,
        detail: c.validUntil && c.validUntil < today ? 'Certification expired' : `Valid until ${isoDate(c.validUntil)}`,
        date: isoDate(c.validUntil),
      })),
    ]
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
      .slice(0, 6);

    return {
      totalStaff,
      teaching,
      nonTeaching: totalStaff - teaching,
      pendingLeaves,
      appraisalsOpen: appraisalsTotal - closed,
      appraisalsClosed: closed,
      presentToday: (att.PRESENT ?? 0) + (att.LATE ?? 0),
      attendanceTotal: Object.values(att).reduce((s, n) => s + n, 0),
      expiringItems,
      leaveQueue: leaveQueue.map((l) => ({
        id: l.id,
        staffName: l.staff.fullName,
        department: l.staff.department.name,
        leaveType: l.leaveType.name,
        fromDate: isoDate(l.fromDate),
        toDate: isoDate(l.toDate),
        days: Number(l.days),
        status: l.status,
        awaiting: l.status === 'PENDING_HR' ? 'HR' : (l.currentApprover?.fullName ?? 'Reporting manager'),
      })),
      departmentCounts: byDepartment
        .map((r) => ({ name: deptById.get(r.departmentId) ?? 'Unknown', count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      ratingCounts: ratings.map((r) => ({ rating: r.finalRating as string, count: r._count._all })),
    };
  }
}
