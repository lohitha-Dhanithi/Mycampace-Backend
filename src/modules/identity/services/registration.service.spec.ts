import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  let service: RegistrationService;
  const roles = {
    findRegistrationOptions: jest.fn(),
    findActiveByCode: jest.fn(),
  };
  const registration = {
    findTenantByCode: jest.fn(),
    findUserByEmailTenant: jest.fn(),
    createSelfRegisteredUser: jest.fn(),
    createRegistrationRequest: jest.fn(),
    activatePendingRoles: jest.fn(),
  };
  const passwordService = {
    assertPolicy: jest.fn(),
    hash: jest.fn().mockResolvedValue('hash'),
  };
  const authService = {
    createActivationTokenForUser: jest.fn().mockResolvedValue({ rawToken: 't', expiresAt: new Date() }),
  };
  const notification = { sendAuthNotification: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RegistrationService(
      roles as never,
      registration as never,
      passwordService as never,
      authService as never,
      notification as never,
      config as never,
    );
  });

  it('returns registration options without ADMIN_ONLY', async () => {
    roles.findRegistrationOptions.mockResolvedValue([
      { code: 'STUDENT', displayName: 'Student', registrationMode: 'SELF', invitationRequired: false, selfRegistrationAllowed: true, description: null },
      { code: 'CHAIRMAN', displayName: 'Chairman', registrationMode: 'ADMIN_ONLY', invitationRequired: true, selfRegistrationAllowed: false, description: null },
    ]);
    const opts = await service.getRegistrationOptions();
    expect(opts.every((o) => o.code !== 'CHAIRMAN')).toBe(true);
    expect(opts.some((o) => o.code === 'STUDENT')).toBe(true);
  });

  it('rejects unknown role', async () => {
    registration.findTenantByCode.mockResolvedValue({ id: 't1', status: 'ACTIVE' });
    roles.findActiveByCode.mockResolvedValue(null);
    passwordService.assertPolicy.mockReturnValue(undefined);
    await expect(
      service.register({
        email: 'a@x.com',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
        registrationRoleCode: 'NOPE',
        tenantCode: 'demo',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects CHAIRMAN self registration', async () => {
    registration.findTenantByCode.mockResolvedValue({ id: 't1', status: 'ACTIVE' });
    roles.findActiveByCode.mockResolvedValue({
      id: 'r1',
      code: 'CHAIRMAN',
      registrationMode: 'ADMIN_ONLY',
      selfRegistrationAllowed: false,
      invitationRequired: true,
      isActive: true,
    });
    await expect(
      service.register({
        email: 'a@x.com',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
        registrationRoleCode: 'CHAIRMAN',
        tenantCode: 'demo',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates pending approval for invitation-required roles', async () => {
    registration.findTenantByCode.mockResolvedValue({ id: 't1', status: 'ACTIVE' });
    registration.findUserByEmailTenant.mockResolvedValue(null);
    roles.findActiveByCode.mockResolvedValue({
      id: 'r1',
      code: 'PRINCIPAL',
      registrationMode: 'INVITATION',
      selfRegistrationAllowed: false,
      invitationRequired: true,
      isActive: true,
      defaultPersonaType: 'STAFF',
    });
    registration.createRegistrationRequest.mockResolvedValue({ id: 'req1' });
    const res = await service.register({
      email: 'p@x.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
      registrationRoleCode: 'PRINCIPAL',
      tenantCode: 'demo',
    });
    expect(res.status).toBe('PENDING_APPROVAL');
    expect(registration.createSelfRegisteredUser).not.toHaveBeenCalled();
  });

  it('self-registers student and issues activation', async () => {
    registration.findTenantByCode.mockResolvedValue({ id: 't1', status: 'ACTIVE' });
    registration.findUserByEmailTenant.mockResolvedValue(null);
    roles.findActiveByCode.mockResolvedValue({
      id: 'r1',
      code: 'STUDENT',
      registrationMode: 'SELF',
      selfRegistrationAllowed: true,
      invitationRequired: false,
      isActive: true,
      defaultPersonaType: 'STUDENT',
    });
    registration.createSelfRegisteredUser.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 's@x.com',
    });
    const res = await service.register({
      email: 's@x.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
      registrationRoleCode: 'STUDENT',
      tenantCode: 'demo',
    });
    expect(res.status).toBe('PENDING_ACTIVATION');
    expect(authService.createActivationTokenForUser).toHaveBeenCalled();
  });

  it('rejects duplicate email in tenant', async () => {
    registration.findTenantByCode.mockResolvedValue({ id: 't1', status: 'ACTIVE' });
    roles.findActiveByCode.mockResolvedValue({
      id: 'r1',
      code: 'STUDENT',
      registrationMode: 'SELF',
      selfRegistrationAllowed: true,
      invitationRequired: false,
      isActive: true,
      defaultPersonaType: 'STUDENT',
    });
    registration.findUserByEmailTenant.mockResolvedValue({ id: 'existing' });
    await expect(
      service.register({
        email: 's@x.com',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
        registrationRoleCode: 'STUDENT',
        tenantCode: 'demo',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
