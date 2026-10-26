import { Injectable } from '@nestjs/common';
import {
  CalendarEventStatus, CalendarEventType, CurriculumStatus, Prisma, SemesterStatus,
} from '../../../generated/prisma-client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CurriculumSemesterCalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProgram(tenantId: string, programId: string) {
    return this.prisma.program.findFirst({ where: { id: programId, tenantId, deletedAt: null } });
  }
  findAcademicYear(tenantId: string, academicYearId: string) {
    return this.prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId, deletedAt: null } });
  }
  findCourse(tenantId: string, courseId: string) {
    return this.prisma.course.findFirst({ where: { id: courseId, tenantId, deletedAt: null } });
  }
  findSemester(tenantId: string, semesterId: string) {
    return this.prisma.semester.findFirst({ where: { id: semesterId, tenantId, deletedAt: null } });
  }

  // Curriculum
  listCurricula(tenantId: string, q: { programId?: string; academicYearId?: string; institutionId?: string }) {
    return this.prisma.curriculum.findMany({
      where: {
        tenantId, deletedAt: null,
        ...(q.programId ? { programId: q.programId } : {}),
        ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}),
        ...(q.institutionId ? { institutionId: q.institutionId } : {}),
      },
      include: {
        program: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, code: true } },
        courses: { include: { course: { select: { id: true, code: true, name: true } } }, orderBy: { sequence: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }
  findCurriculum(id: string, tenantId: string) {
    return this.prisma.curriculum.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        program: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, code: true } },
        courses: { include: { course: { select: { id: true, code: true, name: true } } }, orderBy: { sequence: 'asc' } },
      },
    });
  }
  findCurriculumByCode(tenantId: string, programId: string, academicYearId: string, code: string) {
    return this.prisma.curriculum.findFirst({
      where: { tenantId, programId, academicYearId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
    });
  }
  async createCurriculum(
    data: Prisma.CurriculumCreateInput,
    courseItems: Array<{ courseId: string; sequence: number }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.curriculum.create({ data });
      if (courseItems.length) {
        await tx.curriculumCourse.createMany({
          data: courseItems.map((c) => ({
            tenantId: cur.tenantId,
            curriculumId: cur.id,
            courseId: c.courseId,
            sequence: c.sequence,
          })),
        });
      }
      return tx.curriculum.findFirst({
        where: { id: cur.id },
        include: {
          program: { select: { id: true, code: true, name: true } },
          academicYear: { select: { id: true, code: true } },
          courses: { include: { course: { select: { id: true, code: true, name: true } } }, orderBy: { sequence: 'asc' } },
        },
      });
    });
  }
  updateCurriculum(id: string, tenantId: string, data: Prisma.CurriculumUpdateInput) {
    return this.prisma.curriculum.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  async replaceCurriculumCourses(
    tenantId: string,
    curriculumId: string,
    courseItems: Array<{ courseId: string; sequence: number }>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.curriculumCourse.deleteMany({ where: { curriculumId, tenantId } });
      if (courseItems.length) {
        await tx.curriculumCourse.createMany({
          data: courseItems.map((c) => ({
            tenantId,
            curriculumId,
            courseId: c.courseId,
            sequence: c.sequence,
          })),
        });
      }
    });
  }
  archiveCurriculum(id: string, tenantId: string) {
    return this.prisma.curriculum.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: CurriculumStatus.ARCHIVED, deletedAt: new Date() },
    });
  }

  // Semester
  listSemesters(tenantId: string, q: { academicYearId?: string; institutionId?: string }) {
    return this.prisma.semester.findMany({
      where: {
        tenantId, deletedAt: null,
        ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}),
        ...(q.institutionId ? { institutionId: q.institutionId } : {}),
      },
      include: { academicYear: { select: { id: true, code: true } } },
      orderBy: [{ sequence: 'asc' }, { startDate: 'asc' }],
    });
  }
  findSemesterById(id: string, tenantId: string) {
    return this.prisma.semester.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { academicYear: { select: { id: true, code: true } } },
    });
  }
  findSemesterByCode(tenantId: string, academicYearId: string, code: string) {
    return this.prisma.semester.findFirst({
      where: { tenantId, academicYearId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
    });
  }
  createSemester(data: Prisma.SemesterCreateInput) {
    return this.prisma.semester.create({
      data,
      include: { academicYear: { select: { id: true, code: true } } },
    });
  }
  updateSemester(id: string, tenantId: string, data: Prisma.SemesterUpdateInput) {
    return this.prisma.semester.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  archiveSemester(id: string, tenantId: string) {
    return this.prisma.semester.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: SemesterStatus.ARCHIVED, deletedAt: new Date() },
    });
  }

  // Calendar
  listEvents(tenantId: string, q: { academicYearId?: string; institutionId?: string; semesterId?: string }) {
    return this.prisma.calendarEvent.findMany({
      where: {
        tenantId, deletedAt: null,
        ...(q.academicYearId ? { academicYearId: q.academicYearId } : {}),
        ...(q.institutionId ? { institutionId: q.institutionId } : {}),
        ...(q.semesterId ? { semesterId: q.semesterId } : {}),
      },
      include: {
        academicYear: { select: { id: true, code: true } },
        semester: { select: { id: true, code: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }
  findEvent(id: string, tenantId: string) {
    return this.prisma.calendarEvent.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        academicYear: { select: { id: true, code: true } },
        semester: { select: { id: true, code: true, name: true } },
      },
    });
  }
  createEvent(data: Prisma.CalendarEventCreateInput) {
    return this.prisma.calendarEvent.create({
      data,
      include: {
        academicYear: { select: { id: true, code: true } },
        semester: { select: { id: true, code: true, name: true } },
      },
    });
  }
  updateEvent(id: string, tenantId: string, data: Prisma.CalendarEventUpdateInput) {
    return this.prisma.calendarEvent.updateMany({ where: { id, tenantId, deletedAt: null }, data });
  }
  archiveEvent(id: string, tenantId: string) {
    return this.prisma.calendarEvent.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { status: CalendarEventStatus.ARCHIVED, deletedAt: new Date() },
    });
  }
}
