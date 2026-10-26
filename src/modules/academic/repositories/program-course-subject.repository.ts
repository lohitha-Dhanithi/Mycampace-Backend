import { Injectable } from '@nestjs/common';
import { CourseStatus, ProgramStatus, Prisma, SubjectStatus } from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProgramCourseSubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Program ---
  listPrograms(tenantId: string, q: { institutionId?: string; departmentId?: string }) {
    return this.prisma.program.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q.institutionId ? { institutionId: q.institutionId } : {}),
        ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      },
      include: {
        department: { select: { id: true, code: true, name: true } },
        institution: { select: { id: true, name: true } },
        _count: { select: { courses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
  findProgram(id: string, tenantId: string) {
    return this.prisma.program.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: { select: { id: true, code: true, name: true } },
        institution: { select: { id: true, name: true } },
        _count: { select: { courses: true } },
      },
    });
  }
  findProgramByCode(tenantId: string, institutionId: string, code: string) {
    return this.prisma.program.findFirst({
      where: { tenantId, institutionId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
    });
  }
  findDepartment(tenantId: string, departmentId: string) {
    return this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, deletedAt: null },
    });
  }
  createProgram(data: Prisma.ProgramCreateInput) {
    return this.prisma.program.create({
      data,
      include: {
        department: { select: { id: true, code: true, name: true } },
        institution: { select: { id: true, name: true } },
        _count: { select: { courses: true } },
      },
    });
  }
  updateProgram(id: string, tenantId: string, data: Prisma.ProgramUpdateInput) {
    return this.prisma.program.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  archiveProgram(id: string, tenantId: string) {
    return this.prisma.program.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: ProgramStatus.ARCHIVED, deletedAt: new Date() },
    });
  }

  // --- Course ---
  listCourses(tenantId: string, q: { programId?: string; institutionId?: string }) {
    return this.prisma.course.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q.programId ? { programId: q.programId } : {}),
        ...(q.institutionId ? { institutionId: q.institutionId } : {}),
      },
      include: {
        program: { select: { id: true, code: true, name: true } },
        _count: { select: { subjects: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
  findCourse(id: string, tenantId: string) {
    return this.prisma.course.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        program: { select: { id: true, code: true, name: true } },
        _count: { select: { subjects: true } },
      },
    });
  }
  findCourseByCode(tenantId: string, programId: string, code: string) {
    return this.prisma.course.findFirst({
      where: { tenantId, programId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
    });
  }
  createCourse(data: Prisma.CourseCreateInput) {
    return this.prisma.course.create({
      data,
      include: {
        program: { select: { id: true, code: true, name: true } },
        _count: { select: { subjects: true } },
      },
    });
  }
  updateCourse(id: string, tenantId: string, data: Prisma.CourseUpdateInput) {
    return this.prisma.course.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  archiveCourse(id: string, tenantId: string) {
    return this.prisma.course.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: CourseStatus.ARCHIVED, deletedAt: new Date() },
    });
  }

  // --- Subject ---
  listSubjects(tenantId: string, q: { courseId?: string; institutionId?: string }) {
    return this.prisma.subject.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q.courseId ? { courseId: q.courseId } : {}),
        ...(q.institutionId ? { institutionId: q.institutionId } : {}),
      },
      include: {
        course: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ sequence: 'asc' }, { name: 'asc' }],
    });
  }
  findSubject(id: string, tenantId: string) {
    return this.prisma.subject.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { course: { select: { id: true, code: true, name: true } } },
    });
  }
  findSubjectByCode(tenantId: string, courseId: string, code: string) {
    return this.prisma.subject.findFirst({
      where: { tenantId, courseId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
    });
  }
  createSubject(data: Prisma.SubjectCreateInput) {
    return this.prisma.subject.create({
      data,
      include: { course: { select: { id: true, code: true, name: true } } },
    });
  }
  updateSubject(id: string, tenantId: string, data: Prisma.SubjectUpdateInput) {
    return this.prisma.subject.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  archiveSubject(id: string, tenantId: string) {
    return this.prisma.subject.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: SubjectStatus.ARCHIVED, deletedAt: new Date() },
    });
  }
}
