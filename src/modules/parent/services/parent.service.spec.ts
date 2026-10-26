import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ParentService } from './parent.service';

describe('ParentService', () => {
  const repo = {
    listActiveStudentsForParent: jest.fn(),
    findActiveLink: jest.fn(),
    listAdmissionsForStudentIds: jest.fn(),
    findAdmissionForParent: jest.fn(),
  };
  let service: ParentService;
  const auth = {
    userId: 'parent-1',
    tenantId: 'tenant-a',
    email: 'p@x.com',
    personaType: 'PARENT',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ParentService(repo as never, { log: jest.fn() } as never);
  });

  it('lists only linked students', async () => {
    repo.listActiveStudentsForParent.mockResolvedValue([
      {
        id: 'rel-1',
        relationshipType: 'GUARDIAN',
        status: 'ACTIVE',
        studentUser: {
          id: 'stu-1',
          email: 's@x.com',
          status: 'ACTIVE',
          personaType: 'STUDENT',
        },
        institution: null,
      },
    ]);
    const list = await service.listStudents(auth);
    expect(list).toHaveLength(1);
    expect(list[0].student.id).toBe('stu-1');
    expect(repo.listActiveStudentsForParent).toHaveBeenCalledWith(
      'parent-1',
      'tenant-a',
    );
  });

  it('rejects unlinked student admission filter', async () => {
    repo.listActiveStudentsForParent.mockResolvedValue([
      {
        id: 'rel-1',
        relationshipType: 'GUARDIAN',
        status: 'ACTIVE',
        studentUser: { id: 'stu-1', email: 's@x.com', status: 'ACTIVE', personaType: 'STUDENT' },
        institution: null,
      },
    ]);
    await expect(
      service.listAdmissions(auth, 'stu-OTHER'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('getStudent not found when no active link', async () => {
    repo.findActiveLink.mockResolvedValue(null);
    await expect(service.getStudent(auth, 'stu-x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('empty links yields empty admissions', async () => {
    repo.listActiveStudentsForParent.mockResolvedValue([]);
    repo.listAdmissionsForStudentIds.mockResolvedValue([]);
    const apps = await service.listAdmissions(auth);
    expect(apps).toEqual([]);
  });
});
