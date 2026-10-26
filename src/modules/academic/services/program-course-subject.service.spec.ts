import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ProgramCourseSubjectService } from './program-course-subject.service';

describe('ProgramCourseSubjectService', () => {
  const repo = {
    listPrograms: jest.fn(),
    findProgram: jest.fn(),
    findProgramByCode: jest.fn(),
    findDepartment: jest.fn(),
    createProgram: jest.fn(),
    updateProgram: jest.fn(),
    archiveProgram: jest.fn(),
    listCourses: jest.fn(),
    findCourse: jest.fn(),
    findCourseByCode: jest.fn(),
    createCourse: jest.fn(),
    updateCourse: jest.fn(),
    archiveCourse: jest.fn(),
    listSubjects: jest.fn(),
    findSubject: jest.fn(),
    findSubjectByCode: jest.fn(),
    createSubject: jest.fn(),
    updateSubject: jest.fn(),
    archiveSubject: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const auth = { userId: 'u1', tenantId: 't1', email: 'a@x.com', personaType: 'STAFF' };
  let svc: ProgramCourseSubjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ProgramCourseSubjectService(repo as never, audit as never);
  });

  it('rejects program create when department outside tenant', async () => {
    repo.findDepartment.mockResolvedValue(null);
    await expect(
      svc.createProgram(auth, {
        institutionId: 'i1',
        departmentId: 'd1',
        code: 'BTECH',
        name: 'B.Tech',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects program when department institution mismatch', async () => {
    repo.findDepartment.mockResolvedValue({ id: 'd1', institutionId: 'other' });
    await expect(
      svc.createProgram(auth, {
        institutionId: 'i1',
        departmentId: 'd1',
        code: 'BTECH',
        name: 'B.Tech',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects duplicate program code', async () => {
    repo.findDepartment.mockResolvedValue({ id: 'd1', institutionId: 'i1' });
    repo.findProgramByCode.mockResolvedValue({ id: 'p1' });
    await expect(
      svc.createProgram(auth, {
        institutionId: 'i1',
        departmentId: 'd1',
        code: 'BTECH',
        name: 'B.Tech',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects course when parent program not in tenant', async () => {
    repo.findProgram.mockResolvedValue(null);
    await expect(
      svc.createCourse(auth, { programId: 'p-other', code: 'CS101', name: 'Intro' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects subject when parent course not in tenant', async () => {
    repo.findCourse.mockResolvedValue(null);
    await expect(
      svc.createSubject(auth, { courseId: 'c-other', code: 'UNIT1', name: 'Unit 1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('program not found', async () => {
    repo.findProgram.mockResolvedValue(null);
    await expect(svc.getProgram(auth, 'x')).rejects.toThrow(NotFoundException);
  });

  it('archives course', async () => {
    repo.findCourse.mockResolvedValue({
      id: 'c1', tenantId: 't1', institutionId: 'i1', programId: 'p1',
      code: 'CS101', name: 'Intro', description: null, credits: 3, status: 'ACTIVE',
      createdAt: new Date(), updatedAt: new Date(),
    });
    repo.archiveCourse.mockResolvedValue({ count: 1 });
    const res = await svc.archiveCourse(auth, 'c1');
    expect(res.message).toContain('archived');
  });
});
