import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CourseStatus, ProgramStatus, SubjectStatus } from '../../../generated/prisma-client';
import { ProgramCourseSubjectRepository } from '../repositories/program-course-subject.repository';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  CreateProgramDto,
  UpdateProgramDto,
  CreateCourseDto,
  UpdateCourseDto,
  CreateSubjectDto,
  UpdateSubjectDto,
} from '../dto/program-course-subject.dto';

@Injectable()
export class ProgramCourseSubjectService {
  constructor(
    private readonly repo: ProgramCourseSubjectRepository,
    private readonly audit: AuditService,
  ) {}

  // -------- Programs --------
  listPrograms(auth: AuthContext, q: { institutionId?: string; departmentId?: string }) {
    return this.repo.listPrograms(auth.tenantId, q).then((rows) => rows.map((r) => this.toProgram(r)));
  }

  async getProgram(auth: AuthContext, id: string) {
    const row = await this.repo.findProgram(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: 'Program not found.' });
    return this.toProgram(row);
  }

  async createProgram(auth: AuthContext, dto: CreateProgramDto) {
    const dept = await this.repo.findDepartment(auth.tenantId, dto.departmentId);
    if (!dept || dept.institutionId !== dto.institutionId) {
      throw new ForbiddenException({
        code: 'DEPARTMENT_SCOPE_DENIED',
        message: 'Department not found in the selected institution/tenant.',
      });
    }
    const code = dto.code.trim().toUpperCase();
    if (await this.repo.findProgramByCode(auth.tenantId, dto.institutionId, code)) {
      throw new ConflictException({
        code: 'PROGRAM_CODE_EXISTS',
        message: 'A program with this code already exists for the institution.',
      });
    }
    const created = await this.repo.createProgram({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      status: (dto.status as ProgramStatus) ?? ProgramStatus.ACTIVE,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: dto.institutionId } },
      department: { connect: { id: dto.departmentId } },
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'program.create',
      module: 'academic',
      entityType: 'Program',
      entityId: created.id,
      result: 'SUCCESS',
    });
    return this.toProgram(created);
  }

  async updateProgram(auth: AuthContext, id: string, dto: UpdateProgramDto) {
    const row = await this.repo.findProgram(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: 'Program not found.' });
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findProgramByCode(auth.tenantId, row.institutionId, code);
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'PROGRAM_CODE_EXISTS', message: 'Program code already exists.' });
      }
    }
    await this.repo.updateProgram(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      ...(dto.status ? { status: dto.status as ProgramStatus } : {}),
      ...(dto.departmentId ? { department: { connect: { id: dto.departmentId } } } : {}),
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'program.update',
      module: 'academic',
      entityType: 'Program',
      entityId: id,
      result: 'SUCCESS',
    });
    return this.getProgram(auth, id);
  }

  async archiveProgram(auth: AuthContext, id: string) {
    const row = await this.repo.findProgram(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', message: 'Program not found.' });
    await this.repo.archiveProgram(id, auth.tenantId);
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'program.archive',
      module: 'academic',
      entityType: 'Program',
      entityId: id,
      result: 'SUCCESS',
    });
    return { message: 'Program archived.' };
  }

  // -------- Courses --------
  listCourses(auth: AuthContext, q: { programId?: string; institutionId?: string }) {
    return this.repo.listCourses(auth.tenantId, q).then((rows) => rows.map((r) => this.toCourse(r)));
  }

  async getCourse(auth: AuthContext, id: string) {
    const row = await this.repo.findCourse(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    return this.toCourse(row);
  }

  async createCourse(auth: AuthContext, dto: CreateCourseDto) {
    const program = await this.repo.findProgram(dto.programId, auth.tenantId);
    if (!program) {
      throw new ForbiddenException({
        code: 'PROGRAM_SCOPE_DENIED',
        message: 'Program not found in your tenant.',
      });
    }
    const code = dto.code.trim().toUpperCase();
    if (await this.repo.findCourseByCode(auth.tenantId, dto.programId, code)) {
      throw new ConflictException({
        code: 'COURSE_CODE_EXISTS',
        message: 'A course with this code already exists under the program.',
      });
    }
    const created = await this.repo.createCourse({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      credits: dto.credits,
      status: (dto.status as CourseStatus) ?? CourseStatus.ACTIVE,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: program.institutionId } },
      program: { connect: { id: dto.programId } },
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'course.create',
      module: 'academic',
      entityType: 'Course',
      entityId: created.id,
      result: 'SUCCESS',
    });
    return this.toCourse(created);
  }

  async updateCourse(auth: AuthContext, id: string, dto: UpdateCourseDto) {
    const row = await this.repo.findCourse(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findCourseByCode(auth.tenantId, row.programId, code);
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'COURSE_CODE_EXISTS', message: 'Course code already exists.' });
      }
    }
    await this.repo.updateCourse(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      ...(dto.credits !== undefined ? { credits: dto.credits } : {}),
      ...(dto.status ? { status: dto.status as CourseStatus } : {}),
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'course.update',
      module: 'academic',
      entityType: 'Course',
      entityId: id,
      result: 'SUCCESS',
    });
    return this.getCourse(auth, id);
  }

  async archiveCourse(auth: AuthContext, id: string) {
    const row = await this.repo.findCourse(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'COURSE_NOT_FOUND', message: 'Course not found.' });
    await this.repo.archiveCourse(id, auth.tenantId);
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'course.archive',
      module: 'academic',
      entityType: 'Course',
      entityId: id,
      result: 'SUCCESS',
    });
    return { message: 'Course archived.' };
  }

  // -------- Subjects --------
  listSubjects(auth: AuthContext, q: { courseId?: string; institutionId?: string }) {
    return this.repo.listSubjects(auth.tenantId, q).then((rows) => rows.map((r) => this.toSubject(r)));
  }

  async getSubject(auth: AuthContext, id: string) {
    const row = await this.repo.findSubject(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'SUBJECT_NOT_FOUND', message: 'Subject not found.' });
    return this.toSubject(row);
  }

  async createSubject(auth: AuthContext, dto: CreateSubjectDto) {
    const course = await this.repo.findCourse(dto.courseId, auth.tenantId);
    if (!course) {
      throw new ForbiddenException({
        code: 'COURSE_SCOPE_DENIED',
        message: 'Course not found in your tenant.',
      });
    }
    const code = dto.code.trim().toUpperCase();
    if (await this.repo.findSubjectByCode(auth.tenantId, dto.courseId, code)) {
      throw new ConflictException({
        code: 'SUBJECT_CODE_EXISTS',
        message: 'A subject with this code already exists under the course.',
      });
    }
    const created = await this.repo.createSubject({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      sequence: dto.sequence ?? 0,
      status: (dto.status as SubjectStatus) ?? SubjectStatus.ACTIVE,
      tenant: { connect: { id: auth.tenantId } },
      institution: { connect: { id: course.institutionId } },
      course: { connect: { id: dto.courseId } },
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'subject.create',
      module: 'academic',
      entityType: 'Subject',
      entityId: created.id,
      result: 'SUCCESS',
    });
    return this.toSubject(created);
  }

  async updateSubject(auth: AuthContext, id: string, dto: UpdateSubjectDto) {
    const row = await this.repo.findSubject(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'SUBJECT_NOT_FOUND', message: 'Subject not found.' });
    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findSubjectByCode(auth.tenantId, row.courseId, code);
      if (clash && clash.id !== id) {
        throw new ConflictException({ code: 'SUBJECT_CODE_EXISTS', message: 'Subject code already exists.' });
      }
    }
    await this.repo.updateSubject(id, auth.tenantId, {
      ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
      ...(dto.status ? { status: dto.status as SubjectStatus } : {}),
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'subject.update',
      module: 'academic',
      entityType: 'Subject',
      entityId: id,
      result: 'SUCCESS',
    });
    return this.getSubject(auth, id);
  }

  async archiveSubject(auth: AuthContext, id: string) {
    const row = await this.repo.findSubject(id, auth.tenantId);
    if (!row) throw new NotFoundException({ code: 'SUBJECT_NOT_FOUND', message: 'Subject not found.' });
    await this.repo.archiveSubject(id, auth.tenantId);
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'subject.archive',
      module: 'academic',
      entityType: 'Subject',
      entityId: id,
      result: 'SUCCESS',
    });
    return { message: 'Subject archived.' };
  }

  private toProgram(r: {
    id: string; tenantId: string; institutionId: string; departmentId: string;
    code: string; name: string; description: string | null; status: string;
    createdAt: Date; updatedAt: Date;
    department?: { id: string; code: string; name: string } | null;
    institution?: { id: string; name: string } | null;
    _count?: { courses: number };
  }) {
    return {
      id: r.id, tenantId: r.tenantId, institutionId: r.institutionId, departmentId: r.departmentId,
      code: r.code, name: r.name, description: r.description, status: r.status,
      departmentName: r.department?.name, departmentCode: r.department?.code,
      institutionName: r.institution?.name, courseCount: r._count?.courses ?? 0,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toCourse(r: {
    id: string; tenantId: string; institutionId: string; programId: string;
    code: string; name: string; description: string | null; credits: number | null; status: string;
    createdAt: Date; updatedAt: Date;
    program?: { id: string; code: string; name: string } | null;
    _count?: { subjects: number };
  }) {
    return {
      id: r.id, tenantId: r.tenantId, institutionId: r.institutionId, programId: r.programId,
      code: r.code, name: r.name, description: r.description, credits: r.credits, status: r.status,
      programName: r.program?.name, programCode: r.program?.code,
      subjectCount: r._count?.subjects ?? 0,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toSubject(r: {
    id: string; tenantId: string; institutionId: string; courseId: string;
    code: string; name: string; description: string | null; sequence: number; status: string;
    createdAt: Date; updatedAt: Date;
    course?: { id: string; code: string; name: string } | null;
  }) {
    return {
      id: r.id, tenantId: r.tenantId, institutionId: r.institutionId, courseId: r.courseId,
      code: r.code, name: r.name, description: r.description, sequence: r.sequence, status: r.status,
      courseName: r.course?.name, courseCode: r.course?.code,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }
}
