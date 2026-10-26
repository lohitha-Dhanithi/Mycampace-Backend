import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

const ATTENDANCE_INCLUDE = {
  staff: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      department: { select: { id: true, name: true } },
    },
  },
  shift: { select: { id: true, name: true, startTime: true, endTime: true } },
} satisfies Prisma.AttendanceRecordInclude;

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Shifts ----
  listShifts(tenantId: string, campusId?: string) {
    return this.prisma.shift.findMany({
      where: { tenantId, deletedAt: null, ...(campusId ? { campusId } : {}) },
      include: {
        campus: { select: { id: true, name: true } },
        _count: { select: { assignments: { where: { effectiveTo: null } } } },
      },
      orderBy: [{ campusId: 'asc' }, { startTime: 'asc' }],
    });
  }
  findShift(id: string, tenantId: string) {
    return this.prisma.shift.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
  findShiftByName(tenantId: string, campusId: string, name: string) {
    return this.prisma.shift.findFirst({
      where: { tenantId, campusId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  }
  createShift(data: Prisma.ShiftUncheckedCreateInput) {
    return this.prisma.shift.create({ data });
  }
  updateShift(id: string, tenantId: string, data: Prisma.ShiftUncheckedUpdateManyInput) {
    return this.prisma.shift.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  archiveShift(id: string, tenantId: string) {
    return this.prisma.shift.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }
  findCampus(id: string, tenantId: string) {
    return this.prisma.campus.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  }

  /** Close any open assignment for each staff member, then open the new one. */
  assignShift(tenantId: string, shiftId: string, staffIds: string[], effectiveFrom: Date) {
    return this.prisma.$transaction([
      this.prisma.shiftAssignment.updateMany({
        where: { tenantId, staffId: { in: staffIds }, effectiveTo: null },
        data: { effectiveTo: effectiveFrom },
      }),
      this.prisma.shiftAssignment.createMany({
        data: staffIds.map((staffId) => ({ tenantId, shiftId, staffId, effectiveFrom })),
        skipDuplicates: true,
      }),
    ]);
  }
  countTenantStaff(tenantId: string, ids: string[]) {
    return this.prisma.staff.count({ where: { tenantId, deletedAt: null, id: { in: ids } } });
  }

  // ---- Attendance ----
  listForDate(tenantId: string, date: Date, campusId?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { tenantId, attendanceDate: date, ...(campusId ? { campusId } : {}) },
      include: ATTENDANCE_INCLUDE,
      orderBy: { staff: { fullName: 'asc' } },
    });
  }
  listForStaff(tenantId: string, staffId: string, from: Date, to: Date) {
    return this.prisma.attendanceRecord.findMany({
      where: { tenantId, staffId, attendanceDate: { gte: from, lte: to } },
      include: ATTENDANCE_INCLUDE,
      orderBy: { attendanceDate: 'desc' },
    });
  }
  findById(id: string, tenantId: string) {
    return this.prisma.attendanceRecord.findFirst({ where: { id, tenantId }, include: ATTENDANCE_INCLUDE });
  }
  findStaff(id: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, campusId: true, status: true },
    });
  }
  upsert(tenantId: string, staffId: string, date: Date, create: Prisma.AttendanceRecordUncheckedCreateInput, update: Prisma.AttendanceRecordUncheckedUpdateInput) {
    return this.prisma.attendanceRecord.upsert({
      where: { staffId_attendanceDate: { staffId, attendanceDate: date } },
      create,
      update,
      include: ATTENDANCE_INCLUDE,
    });
  }
  update(id: string, tenantId: string, data: Prisma.AttendanceRecordUncheckedUpdateManyInput) {
    return this.prisma.attendanceRecord.updateMany({ where: { id, tenantId }, data });
  }

  /** Active staff (with open shift assignment and approved leave for the date) to seed a day's register. */
  staffForRegister(tenantId: string, date: Date, campusId?: string) {
    return this.prisma.staff.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'SEPARATED' },
        joiningDate: { lte: date },
        ...(campusId ? { campusId } : {}),
      },
      select: {
        id: true,
        campusId: true,
        shiftAssignments: {
          where: { effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: date } }] },
          select: { shiftId: true },
          take: 1,
        },
        leaveRequests: {
          where: { status: 'APPROVED', fromDate: { lte: date }, toDate: { gte: date } },
          select: { id: true },
          take: 1,
        },
      },
    });
  }
  createRegister(rows: Prisma.AttendanceRecordCreateManyInput[]) {
    return this.prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
  }
}
