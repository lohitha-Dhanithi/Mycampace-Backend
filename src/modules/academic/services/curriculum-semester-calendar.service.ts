import {
  Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import {
  CalendarEventStatus, CalendarEventType, CurriculumStatus, SemesterStatus,
} from '../../../generated/prisma-client';
import { CurriculumSemesterCalendarRepository } from '../repositories/curriculum-semester-calendar.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  CreateCurriculumDto, UpdateCurriculumDto,
  CreateSemesterDto, UpdateSemesterDto,
  CreateCalendarEventDto, UpdateCalendarEventDto,
} from '../dto/curriculum-semester-calendar.dto';

@Injectable()
export class CurriculumSemesterCalendarService {
  constructor(
    private readonly repo: CurriculumSemesterCalendarRepository,
    private readonly audit: AuditService,
  ) {}

  private assertRange(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
      throw new BadRequestException({ code: 'INVALID_DATE_RANGE', message: 'End date must be on or after start date.' });
    }
  }

  // ---- Curriculum ----
  listCurricula(auth: AuthContext, q: { programId?: string; academicYearId?: string; institutionId?: string }) {
    return this.repo.listCurricula(auth.tenantId, q).then((rows) => rows.map((r) => this.toCurriculum(r)));
  }
  async getCurriculum(auth: AuthContext, id: string) {
    const row = await this.repo.findCurriculum(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'CURRICULUM_NOT_FOUND', message: 'Curriculum not found.' });
    return this.toCurriculum(row);
  }
  async createCurriculum(auth: AuthContext, dto: CreateCurriculumDto) {
    const program = await this.repo.findProgram(auth.tenantId, dto.programId);
    if (!program) throw new ForbiddenException({ code: 'PROGRAM_SCOPE_DENIED', message: 'Program not found in your tenant.' });
    const year = await this.repo.findAcademicYear(auth.tenantId, dto.academicYearId);
    if (!year) throw new ForbiddenException({ code: 'ACADEMIC_YEAR_SCOPE_DENIED', message: 'Academic year not found in your tenant.' });
    if (year.institutionId !== program.institutionId) {
      throw new ForbiddenException({ code: 'INSTITUTION_MISMATCH', message: 'Program and academic year must belong to the same institution.' });
    }
    const code = dto.code.trim().toUpperCase();
    if (await this.repo.findCurriculumByCode(auth.tenantId, dto.programId, dto.academicYearId, code)) {
      throw new ConflictException({ code: 'CURRICULUM_CODE_EXISTS', message: 'Curriculum code already exists for this program and year.' });
    }
    const courseItems: Array<{ courseId: string; sequence: number }> = [];
    for (const [i, item] of (dto.courses ?? []).entries()) {
      const course = await this.repo.findCourse(auth.tenantId, item.courseId);
      if (!course || course.programId !== dto.programId) {
        throw new ForbiddenException({ code: 'COURSE_SCOPE_DENIED', message: 'Course not found under the selected program.' });
      }
      courseItems.push({ courseId: item.courseId, sequence: item.sequence ?? i });
    }
    const created = await this.repo.createCurriculum(
      {
        code, name: dto.name.trim(), description: dto.description?.trim(),
        status: (dto.status as CurriculumStatus) ?? CurriculumStatus.DRAFT,
        tenant: { connect: { id: auth.tenantId } },
        institution: { connect: { id: program.institutionId } },
        program: { connect: { id: dto.programId } },
        academicYear: { connect: { id: dto.academicYearId } },
      },
      courseItems,
    );
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'curriculum.create',
      module: 'academic', entityType: 'Curriculum', entityId: created!.id, result: 'SUCCESS',
    });
    return this.toCurriculum(created!);
  }
  async updateCurriculum(auth: AuthContext, id: string, dto: UpdateCurriculumDto) {
    const row = await this.repo.findCurriculum(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'CURRICULUM_NOT_FOUND', message: 'Curriculum not found.' });
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findCurriculumByCode(auth.tenantId, row.programId, row.academicYearId, code);
      if (clash && clash.id !== id) throw new ConflictException({ code: 'CURRICULUM_CODE_EXISTS', message: 'Curriculum code already exists.' });
    }
    await this.repo.updateCurriculum(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      ...(dto.status ? { status: dto.status as CurriculumStatus } : {}),
    });
    if (dto.courses) {
      const courseItems: Array<{ courseId: string; sequence: number }> = [];
      for (const [i, item] of dto.courses.entries()) {
        const course = await this.repo.findCourse(auth.tenantId, item.courseId);
        if (!course || course.programId !== row.programId) {
          throw new ForbiddenException({ code: 'COURSE_SCOPE_DENIED', message: 'Course not found under the curriculum program.' });
        }
        courseItems.push({ courseId: item.courseId, sequence: item.sequence ?? i });
      }
      await this.repo.replaceCurriculumCourses(auth.tenantId, id, courseItems);
    }
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'curriculum.update',
      module: 'academic', entityType: 'Curriculum', entityId: id, result: 'SUCCESS',
    });
    return this.getCurriculum(auth, id);
  }
  async archiveCurriculum(auth: AuthContext, id: string) {
    const row = await this.repo.findCurriculum(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'CURRICULUM_NOT_FOUND', message: 'Curriculum not found.' });
    await this.repo.archiveCurriculum(id, auth.tenantId);
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'curriculum.archive',
      module: 'academic', entityType: 'Curriculum', entityId: id, result: 'SUCCESS',
    });
    return { message: 'Curriculum archived.' };
  }

  // ---- Semester ----
  listSemesters(auth: AuthContext, q: { academicYearId?: string; institutionId?: string }) {
    return this.repo.listSemesters(auth.tenantId, q).then((rows) => rows.map((r) => this.toSemester(r)));
  }
  async getSemester(auth: AuthContext, id: string) {
    const row = await this.repo.findSemesterById(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'SEMESTER_NOT_FOUND', message: 'Semester not found.' });
    return this.toSemester(row);
  }
  async createSemester(auth: AuthContext, dto: CreateSemesterDto) {
    this.assertRange(dto.startDate, dto.endDate);
    const year = await this.repo.findAcademicYear(auth.tenantId, dto.academicYearId);
    if (!year) throw new ForbiddenException({ code: 'ACADEMIC_YEAR_SCOPE_DENIED', message: 'Academic year not found in your tenant.' });
    const code = dto.code.trim().toUpperCase();
    if (await this.repo.findSemesterByCode(auth.tenantId, dto.academicYearId, code)) {
      throw new ConflictException({ code: 'SEMESTER_CODE_EXISTS', message: 'Semester code already exists for this academic year.' });
    }
    const created = await this.repo.createSemester({
      code, name: dto.name.trim(), sequence: dto.sequence ?? 1,
      startDate: new Date(dto.startDate), endDate: new Date(dto.endDate),
      status: (dto.status as SemesterStatus) ?? SemesterStatus.ACTIVE,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: year.institutionId } },
      academicYear: { connect: { id: dto.academicYearId } },
    });
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'semester.create',
      module: 'academic', entityType: 'Semester', entityId: created.id, result: 'SUCCESS',
    });
    return this.toSemester(created);
  }
  async updateSemester(auth: AuthContext, id: string, dto: UpdateSemesterDto) {
    const row = await this.repo.findSemesterById(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'SEMESTER_NOT_FOUND', message: 'Semester not found.' });
    const start = dto.startDate ?? row.startDate.toISOString().slice(0, 10);
    const end = dto.endDate ?? row.endDate.toISOString().slice(0, 10);
    this.assertRange(start, end);
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findSemesterByCode(auth.tenantId, row.academicYearId, code);
      if (clash && clash.id !== id) throw new ConflictException({ code: 'SEMESTER_CODE_EXISTS', message: 'Semester code already exists.' });
    }
    await this.repo.updateSemester(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
      ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
      ...(dto.status ? { status: dto.status as SemesterStatus } : {}),
    });
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'semester.update',
      module: 'academic', entityType: 'Semester', entityId: id, result: 'SUCCESS',
    });
    return this.getSemester(auth, id);
  }
  async archiveSemester(auth: AuthContext, id: string) {
    const row = await this.repo.findSemesterById(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'SEMESTER_NOT_FOUND', message: 'Semester not found.' });
    await this.repo.archiveSemester(id, auth.tenantId);
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'semester.archive',
      module: 'academic', entityType: 'Semester', entityId: id, result: 'SUCCESS',
    });
    return { message: 'Semester archived.' };
  }

  // ---- Calendar ----
  listEvents(auth: AuthContext, q: { academicYearId?: string; institutionId?: string; semesterId?: string }) {
    return this.repo.listEvents(auth.tenantId, q).then((rows) => rows.map((r) => this.toEvent(r)));
  }
  async getEvent(auth: AuthContext, id: string) {
    const row = await this.repo.findEvent(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'CALENDAR_EVENT_NOT_FOUND', message: 'Calendar event not found.' });
    return this.toEvent(row);
  }
  async createEvent(auth: AuthContext, dto: CreateCalendarEventDto) {
    this.assertRange(dto.startDate, dto.endDate);
    const year = await this.repo.findAcademicYear(auth.tenantId, dto.academicYearId);
    if (!year) throw new ForbiddenException({ code: 'ACADEMIC_YEAR_SCOPE_DENIED', message: 'Academic year not found in your tenant.' });
    if (dto.semesterId) {
      const sem = await this.repo.findSemester(auth.tenantId, dto.semesterId);
      if (!sem || sem.academicYearId !== dto.academicYearId) {
        throw new ForbiddenException({ code: 'SEMESTER_SCOPE_DENIED', message: 'Semester not found under the selected academic year.' });
      }
    }
    const created = await this.repo.createEvent({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      eventType: (dto.eventType as CalendarEventType) ?? CalendarEventType.EVENT,
      status: (dto.status as CalendarEventStatus) ?? CalendarEventStatus.SCHEDULED,
      startDate: new Date(dto.startDate), endDate: new Date(dto.endDate),
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: year.institutionId } },
      academicYear: { connect: { id: dto.academicYearId } },
      ...(dto.semesterId ? { semester: { connect: { id: dto.semesterId } } } : {}),
    });
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'calendar.create',
      module: 'academic', entityType: 'CalendarEvent', entityId: created.id, result: 'SUCCESS',
    });
    return this.toEvent(created);
  }
  async updateEvent(auth: AuthContext, id: string, dto: UpdateCalendarEventDto) {
    const row = await this.repo.findEvent(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'CALENDAR_EVENT_NOT_FOUND', message: 'Calendar event not found.' });
    const start = dto.startDate ?? row.startDate.toISOString().slice(0, 10);
    const end = dto.endDate ?? row.endDate.toISOString().slice(0, 10);
    this.assertRange(start, end);
    await this.repo.updateEvent(id, auth.tenantId, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      ...(dto.eventType ? { eventType: dto.eventType as CalendarEventType } : {}),
      ...(dto.status ? { status: dto.status as CalendarEventStatus } : {}),
      ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
      ...(dto.semesterId !== undefined
        ? dto.semesterId
          ? { semester: { connect: { id: dto.semesterId } } }
          : { semester: { disconnect: true } }
        : {}),
    });
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'calendar.update',
      module: 'academic', entityType: 'CalendarEvent', entityId: id, result: 'SUCCESS',
    });
    return this.getEvent(auth, id);
  }
  async archiveEvent(auth: AuthContext, id: string) {
    const row = await this.repo.findEvent(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'CALENDAR_EVENT_NOT_FOUND', message: 'Calendar event not found.' });
    await this.repo.archiveEvent(id, auth.tenantId);
    await this.audit.log({
      tenantId: auth.tenantId, actorUserId: auth.userId, action: 'calendar.archive',
      module: 'academic', entityType: 'CalendarEvent', entityId: id, result: 'SUCCESS',
    });
    return { message: 'Calendar event archived.' };
  }

  private toCurriculum(r: any) {
    return {
      id: r.id, tenantId: r.tenantId, institutionId: r.institutionId,
      programId: r.programId, academicYearId: r.academicYearId,
      code: r.code, name: r.name, description: r.description, status: r.status,
      programName: r.program?.name, programCode: r.program?.code,
      academicYearCode: r.academicYear?.code,
      courses: (r.courses ?? []).map((c: any) => ({
        courseId: c.courseId, sequence: c.sequence,
        code: c.course?.code, name: c.course?.name,
      })),
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }
  private toSemester(r: any) {
    return {
      id: r.id, tenantId: r.tenantId, institutionId: r.institutionId, academicYearId: r.academicYearId,
      code: r.code, name: r.name, sequence: r.sequence, status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10), endDate: r.endDate.toISOString().slice(0, 10),
      academicYearCode: r.academicYear?.code,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }
  private toEvent(r: any) {
    return {
      id: r.id, tenantId: r.tenantId, institutionId: r.institutionId, academicYearId: r.academicYearId,
      semesterId: r.semesterId, title: r.title, eventType: r.eventType, description: r.description, status: r.status,
      startDate: r.startDate.toISOString().slice(0, 10), endDate: r.endDate.toISOString().slice(0, 10),
      academicYearCode: r.academicYear?.code, semesterName: r.semester?.name,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }
}
