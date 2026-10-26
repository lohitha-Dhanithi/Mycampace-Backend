import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new NotificationService();
    logSpy = jest.spyOn((service as unknown as { logger: { log: (...a: unknown[]) => void } }).logger, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs a non-sensitive notification event', async () => {
    await service.sendAuthNotification({
      type: 'password_reset',
      to: 'user@example.com',
      tenantId: 'tenant-1',
      meta: { purpose: 'reset' },
    });
    expect(logSpy).toHaveBeenCalled();
    const logged = logSpy.mock.calls[0][0] as string;
    expect(logged).toContain('auth_notification');
    expect(logged).toContain('password_reset');
    expect(logged).not.toContain('user@example.com'); // masked
  });

  it('strips sensitive meta keys before logging', async () => {
    await service.sendAuthNotification({
      type: 'mfa_otp',
      to: 'user@example.com',
      meta: { otp: '123456', password: 'secret', purpose: 'mfa' },
    });
    const logged = logSpy.mock.calls[0][0] as string;
    expect(logged).not.toContain('123456');
    expect(logged).not.toContain('secret');
    expect(logged).toContain('purpose');
  });
});
