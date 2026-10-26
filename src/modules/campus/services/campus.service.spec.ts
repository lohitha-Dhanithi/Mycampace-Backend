import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CampusService } from './campus.service';

describe('CampusService', () => {
  const repo = {
    list: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findInstitution: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softArchive: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let service: CampusService;
  const auth = {
    userId: 'u1',
    tenantId: 'tenant-a',
    email: 'a@x.com',
    personaType: 'STAFF',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CampusService(repo as never, audit as never);
  });

  it('lists within tenant', async () => {
    await service.list(auth);
    expect(repo.list).toHaveBeenCalledWith('tenant-a', undefined);
  });

  it('rejects institution outside tenant on create', async () => {
    repo.findInstitution.mockResolvedValue(null);
    await expect(
      service.create(auth, {
        institutionId: 'other',
        code: 'C1',
        name: 'North',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('get missing campus', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.get(auth, 'x')).rejects.toThrow(NotFoundException);
  });

  describe('assignments', () => {
    it('rejects assign when campus missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.assignUser(auth, { userId: 'u2', campusId: 'c1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
