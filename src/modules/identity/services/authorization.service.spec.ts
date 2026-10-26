import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const repo = {
    getActivePermissionCodes: jest.fn(),
    getActiveRoleCodes: jest.fn(),
    listPermissions: jest.fn(),
    listRolesWithPermissionCount: jest.fn(),
  };
  let service: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthorizationService(repo as never);
  });

  it('hasPermission true when code present', async () => {
    repo.getActivePermissionCodes.mockResolvedValue(['student.read', 'institution.read']);
    await expect(
      service.hasPermission('u1', 't1', 'student.read'),
    ).resolves.toBe(true);
  });

  it('hasPermission false when missing — deny by default', async () => {
    repo.getActivePermissionCodes.mockResolvedValue(['institution.read']);
    await expect(
      service.hasPermission('u1', 't1', 'admission.manage'),
    ).resolves.toBe(false);
  });

  it('getSnapshot returns roles and permissions for tenant user', async () => {
    repo.getActiveRoleCodes.mockResolvedValue(['SCHOOL_TEACHER']);
    repo.getActivePermissionCodes.mockResolvedValue(['student.read']);
    const snap = await service.getSnapshot('u1', 't1');
    expect(snap).toEqual({
      userId: 'u1',
      tenantId: 't1',
      roles: ['SCHOOL_TEACHER'],
      permissions: ['student.read'],
    });
  });
});
