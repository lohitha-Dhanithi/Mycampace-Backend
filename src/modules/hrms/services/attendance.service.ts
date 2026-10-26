import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { StaffRepository } from '../repositories/staff.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { AssignShiftDto, CreateShiftDto, UpdateShiftDto } from '../dto/hrms-setup.dto';
import {
  AttendanceStatusDto,
  GenerateAttendanceDto,
  MarkAttendanceDto,
  UpdateAttendanceDto,
} from '../dto/attendance-appraisal.dto';
import { isoDate, parseDate, todayUtc } from '../common/hrms.util';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly staffRepo: StaffRepository,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Shifts
  // ---------------------------------------------------------------------------

  async listShifts(auth: AuthContext, campusId?: string) {
    const rows = await this.repo.listShifts(auth.tenantId, campusId);
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      start: s.startTime,
      end: s.endTime,
      graceMinutes: s.graceMinutes,
      campusId: s.campusId,
      campus: s.campus.name,
      assigned: s._count.assignments,
      status: s.status,
    }));
  }

  async createShift(auth: AuthContext, dto: CreateShiftDto) {
    if (!(await this.repo.findCampus(dto.campusId, auth.tenantId))) {
      throw new BadRequestException({ code: 'CAMPUS_NOT_FOUND', message: 'Campus not found in your tenant.' });
    }
    if (await this.repo.findShiftByName(auth.tenantId, dto.campusId, dto.name.trim())) {
      throw new ConflictException({ code: 'HRMS_SHIFT_EXISTS', message: 'A shift with this name already exists on the campus.' });
    }
    const row = await this.repo.createShift({
      tenantId: auth.tenantId,
      campusId: dto.campusId,
      name: dto.name.trim(),
      startTime: dto.startTime,
      endTime: dto.endTime,
      graceMinutes: dto.graceMinutes ?? 15,
    });
    await this.log(auth, 'hrms.shift.create', 'Shift', row.id);
    return row;
  }

  async updateShift(auth: AuthContext, id: string, dto: UpdateShiftDto) {
    const shift = await this.repo.findShift(id, auth.tenantId);
    if (!shift) throw this.shiftNotFound();
    if (dto.campusId && !(await this.repo.findCampus(dto.campusId, auth.tenantId))) {
      throw new BadRequestException({ code: 'CAMPUS_NOT_FOUND', message: 'Campus not found in your tenant.' });
    }
    const campusId = dto.campusId ?? shift.campusId;
    if (dto.name) {
      const clash = await this.repo.findShiftByName(auth.tenantId, campusId, dto.name.trim());
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'HRMS_SHIFT_EXISTS', message: 'A shift with this name already exists on the campus.' });
      }
    }
    await this.repo.updateShift(id, auth.tenantId, {
      ...(dto.campusId ? { campusId: dto.campusId } : {}),
      ...(dto.name ? { name: dto.name.trim() } : {}),
      ...(dto.startTime ? { startTime: dto.startTime } : {}),
      ...(dto.endTime ? { endTime: dto.endTime } : {}),
      ...(dto.graceMinutes !== undefined ? { graceMinutes: dto.graceMinutes } : {}),
    });
    await this.log(auth, 'hrms.shift.update', 'Shift', id);
    return this.repo.findShift(id, auth.tenantId);
  }

  async archiveShift(auth: AuthContext, id: string) {
    if (!(await this.repo.findShift(id, auth.tenantId))) throw this.shiftNotFound();
    await this.repo.archiveShift(id, auth.tenantId);
    await this.log(auth, 'hrms.shift.archive', 'Shift', id);
    return { message: 'Shift archived.' };
  }

  async assignShift(auth: AuthContext, id: string, dto: AssignShiftDto) {
    if (!(await this.repo.findShift(id, auth.tenantId))) throw this.shiftNotFound();
    const unique = [...new Set(dto.staffIds)];
    if ((await this.repo.countTenantStaff(auth.tenantId, unique)) !== unique.length) {
      throw new BadRequestException({ code: 'HRMS_STAFF_NOT_FOUND', message: 'One or more staff members were not found.' });
    }
    await this.repo.assignShift(auth.tenantId, id, unique, parseDate(dto.effectiveFrom));
    await this.log(auth, 'hrms.shift.assign', 'Shift', id, { count: unique.length });
    return { assigned: unique.length };
  }

  // ---------------------------------------------------------------------------
  // Attendance register
  // ---------------------------------------------------------------------------

  async register(auth: AuthContext, date: string, campusId?: string) {
    const rows = await this.repo.listForDate(auth.tenantId, parseDate(date), campusId);
    return { date, records: rows.map((r) => this.toDto(r)) };
  }

  async mine(auth: AuthContext, from: string, to: string) {
    const me = await this.staffRepo.findByUser(auth.userId, auth.email, auth.tenantId);
    if (!me) {
      throw new NotFoundException({ code: 'HRMS_NO_STAFF_RECORD', message: 'No staff record is linked to your account. Contact HR.' });
    }
    const rows = await this.repo.listForStaff(auth.tenantId, me.id, parseDate(from), parseDate(to));
    return rows.map((r) => this.toDto(r));
  }

  /**
   * Seed the register for a date: one row per active staff member. Approved leave → ON_LEAVE;
   * everyone else starts ABSENT until HR marks them (the status enum has no "unmarked" value).
   * Idempotent: existing rows are left untouched.
   */
  async generate(auth: AuthContext, dto: GenerateAttendanceDto) {
    const date = parseDate(dto.date);
    if (date > todayUtc()) {
      throw new BadRequestException({ code: 'HRMS_ATTENDANCE_FUTURE', message: 'Attendance cannot be generated for a future date.' });
    }
    const staff = await this.repo.staffForRegister(auth.tenantId, date, dto.campusId);
    const result = await this.repo.createRegister(
      staff.map((s) => ({
        tenantId: auth.tenantId,
        staffId: s.id,
        campusId: s.campusId,
        shiftId: s.shiftAssignments[0]?.shiftId ?? null,
        attendanceDate: date,
        status: s.leaveRequests.length ? 'ON_LEAVE' : 'ABSENT',
        leaveRequestId: s.leaveRequests[0]?.id ?? null,
        source: s.leaveRequests.length ? 'LEAVE_SYNC' : 'MANUAL',
      })),
    );
    await this.log(auth, 'hrms.attendance.generate', 'AttendanceRecord', dto.date, { created: result.count });
    return { date: dto.date, created: result.count, skippedExisting: staff.length - result.count };
  }

  async mark(auth: AuthContext, dto: MarkAttendanceDto) {
    const staff = await this.repo.findStaff(dto.staffId, auth.tenantId);
    if (!staff) throw new NotFoundException({ code: 'HRMS_STAFF_NOT_FOUND', message: 'Staff record not found.' });
    const date = parseDate(dto.date);
    if (date > todayUtc()) {
      throw new BadRequestException({ code: 'HRMS_ATTENDANCE_FUTURE', message: 'Attendance cannot be marked for a future date.' });
    }
    if (dto.shiftId && !(await this.repo.findShift(dto.shiftId, auth.tenantId))) throw this.shiftNotFound();
    this.assertTimes(dto.checkInAt, dto.checkOutAt);

    const times = this.timesFor(dto.status, dto.checkInAt, dto.checkOutAt);
    const row = await this.repo.upsert(
      auth.tenantId,
      dto.staffId,
      date,
      {
        tenantId: auth.tenantId,
        staffId: dto.staffId,
        campusId: staff.campusId,
        shiftId: dto.shiftId,
        attendanceDate: date,
        status: dto.status,
        ...times,
        remarks: dto.remarks?.trim(),
        markedById: auth.userId,
      },
      {
        status: dto.status,
        ...times,
        ...(dto.shiftId ? { shiftId: dto.shiftId } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks.trim() } : {}),
        source: 'MANUAL',
        markedById: auth.userId,
      },
    );
    await this.log(auth, 'hrms.attendance.mark', 'AttendanceRecord', row.id, { status: dto.status });
    return this.toDto(row);
  }

  async update(auth: AuthContext, id: string, dto: UpdateAttendanceDto) {
    if (!(await this.repo.findById(id, auth.tenantId))) {
      throw new NotFoundException({ code: 'HRMS_ATTENDANCE_NOT_FOUND', message: 'Attendance record not found.' });
    }
    this.assertTimes(dto.checkInAt, dto.checkOutAt);
    await this.repo.update(id, auth.tenantId, {
      status: dto.status,
      ...this.timesFor(dto.status, dto.checkInAt, dto.checkOutAt),
      ...(dto.remarks !== undefined ? { remarks: dto.remarks.trim() } : {}),
      source: 'MANUAL',
      markedById: auth.userId,
    });
    await this.log(auth, 'hrms.attendance.update', 'AttendanceRecord', id, { status: dto.status });
    return this.toDto((await this.repo.findById(id, auth.tenantId))!);
  }

  // ---------------------------------------------------------------------------

  /** Absent / on-leave rows carry no punch times; present and late keep what was supplied. */
  private timesFor(status: AttendanceStatusDto, checkInAt?: string, checkOutAt?: string) {
    if (status === AttendanceStatusDto.ABSENT || status === AttendanceStatusDto.ON_LEAVE) {
      return { checkInAt: null, checkOutAt: null };
    }
    return {
      ...(checkInAt !== undefined ? { checkInAt: new Date(checkInAt) } : {}),
      ...(checkOutAt !== undefined ? { checkOutAt: new Date(checkOutAt) } : {}),
    };
  }

  private assertTimes(checkInAt?: string, checkOutAt?: string) {
    if (checkInAt && checkOutAt && new Date(checkOutAt) < new Date(checkInAt)) {
      throw new BadRequestException({ code: 'HRMS_ATTENDANCE_TIMES_INVALID', message: 'Check-out cannot be before check-in.' });
    }
  }

  private shiftNotFound() {
    return new NotFoundException({ code: 'HRMS_SHIFT_NOT_FOUND', message: 'Shift not found.' });
  }

  private log(auth: AuthContext, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action,
      module: 'hrms',
      entityType,
      entityId,
      metadata,
    });
  }

  private toDto(r: Awaited<ReturnType<AttendanceRepository['listForDate']>>[number]) {
    return {
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff.fullName,
      employeeCode: r.staff.employeeCode,
      department: r.staff.department.name,
      date: isoDate(r.attendanceDate),
      shift: r.shift?.name ?? null,
      status: r.status,
      checkIn: r.checkInAt?.toISOString() ?? null,
      checkOut: r.checkOutAt?.toISOString() ?? null,
      remarks: r.remarks,
      source: r.source,
    };
  }
}
