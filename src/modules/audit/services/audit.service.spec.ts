import { AuditService } from './audit.service';

describe('AuditService', () => {
  const repo = { create: jest.fn().mockResolvedValue({}), listByTenant: jest.fn() };
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(repo as never);
  });

  it('strips sensitive metadata keys', async () => {
    await service.log({
      tenantId: 't1',
      actorUserId: 'u1',
      action: 'auth.login',
      module: 'identity',
      metadata: {
        email: 'a@b.com',
        password: 'secret',
        accessToken: 'jwt',
        ok: true,
      },
    });
    const arg = repo.create.mock.calls[0][0];
    expect(arg.metadata.password).toBeUndefined();
    expect(arg.metadata.accessToken).toBeUndefined();
    expect(arg.metadata.email).toBe('a@b.com');
    expect(arg.metadata.ok).toBe(true);
  });

  it('does not throw when repository fails', async () => {
    repo.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.log({ action: 'x', module: 'y' }),
    ).resolves.toBeUndefined();
  });
});
