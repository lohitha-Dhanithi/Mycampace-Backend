import { ForbiddenException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CurriculumSemesterCalendarService } from './curriculum-semester-calendar.service';

describe('CurriculumSemesterCalendarService', () => {
  const repo = {
    findProgram: jest.fn(), findAcademicYear: jest.fn(), findCourse: jest.fn(), findSemester: jest.fn(),
    listCurricula: jest.fn(), findCurriculum: jest.fn(), findCurriculumByCode: jest.fn(),
    createCurriculum: jest.fn(), updateCurriculum: jest.fn(), replaceCurriculumCourses: jest.fn(), archiveCurriculum: jest.fn(),
    listSemesters: jest.fn(), findSemesterById: jest.fn(), findSemesterByCode: jest.fn(),
    createSemester: jest.fn(), updateSemester: jest.fn(), archiveSemester: jest.fn(),
    listEvents: jest.fn(), findEvent: jest.fn(), createEvent: jest.fn(), updateEvent: jest.fn(), archiveEvent: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const auth = { userId: 'u1', tenantId: 't1', email: 'a@x.com', personaType: 'STAFF' };
  let svc: CurriculumSemesterCalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new CurriculumSemesterCalendarService(repo as never, audit as never);
  });

  it('rejects curriculum when program outside tenant', async () => {
    repo.findProgram.mockResolvedValue(null);
    await expect(svc.createCurriculum(auth, {
      programId: 'p1', academicYearId: 'y1', code: 'C1', name: 'Curr',
    })).rejects.toThrow(ForbiddenException);
  });

  it('rejects curriculum when year outside tenant', async () => {
    repo.findProgram.mockResolvedValue({ id: 'p1', institutionId: 'i1' });
    repo.findAcademicYear.mockResolvedValue(null);
    await expect(svc.createCurriculum(auth, {
      programId: 'p1', academicYearId: 'y1', code: 'C1', name: 'Curr',
    })).rejects.toThrow(ForbiddenException);
  });

  it('rejects curriculum institution mismatch', async () => {
    repo.findProgram.mockResolvedValue({ id: 'p1', institutionId: 'i1' });
    repo.findAcademicYear.mockResolvedValue({ id: 'y1', institutionId: 'i2' });
    await expect(svc.createCurriculum(auth, {
      programId: 'p1', academicYearId: 'y1', code: 'C1', name: 'Curr',
    })).rejects.toThrow(ForbiddenException);
  });

  it('rejects semester invalid date range', async () => {
    repo.findAcademicYear.mockResolvedValue({ id: 'y1', institutionId: 'i1' });
    await expect(svc.createSemester(auth, {
      academicYearId: 'y1', code: 'S1', name: 'Sem 1',
      startDate: '2027-01-01', endDate: '2026-01-01',
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects semester when academic year missing', async () => {
    repo.findAcademicYear.mockResolvedValue(null);
    await expect(svc.createSemester(auth, {
      academicYearId: 'y-other', code: 'S1', name: 'Sem 1',
      startDate: '2026-06-01', endDate: '2026-12-01',
    })).rejects.toThrow(ForbiddenException);
  });

  it('rejects calendar event with foreign semester', async () => {
    repo.findAcademicYear.mockResolvedValue({ id: 'y1', institutionId: 'i1' });
    repo.findSemester.mockResolvedValue({ id: 's1', academicYearId: 'y-other' });
    await expect(svc.createEvent(auth, {
      academicYearId: 'y1', semesterId: 's1', title: 'Holiday',
      startDate: '2026-10-01', endDate: '2026-10-02',
    })).rejects.toThrow(ForbiddenException);
  });

  it('semester not found', async () => {
    repo.findSemesterById.mockResolvedValue(null);
    await expect(svc.getSemester(auth, 'x')).rejects.toThrow(NotFoundException);
  });
});
