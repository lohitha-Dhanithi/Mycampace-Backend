import { UnauthorizedException, ForbiddenException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    tenant: { findFirst: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    activationToken?: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    loginHistory: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwordService: {
    compare: jest.Mock;
    hash: jest.Mock;
    assertPolicy: jest.Mock;
    validatePolicy: jest.Mock;
  };
  let tokenService: {
    createAccessToken: jest.Mock;
    generateRefreshToken: jest.Mock;
    hashRefreshToken: jest.Mock;
    generateOneTimeToken: jest.Mock;
    hashOneTimeToken: jest.Mock;
  };

  const activeUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@school.edu',
    passwordHash: 'hashed',
    personaType: 'STAFF',
    status: 'ACTIVE',
    mfaEnabled: false,
    failedLoginCount: 0,
    lockedUntil: null,
    deletedAt: null,
    tenant: { status: 'ACTIVE', deletedAt: null },
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(activeUser),
      },
      tenant: { findFirst: jest.fn() },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      loginHistory: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          refreshToken: {
            update: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          passwordResetToken: {
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          user: {
            update: jest.fn().mockResolvedValue(activeUser),
          },
        }),
      ),
    };

    passwordService = {
      compare: jest.fn(),
      hash: jest.fn().mockResolvedValue('new-hash'),
      assertPolicy: jest.fn(),
      validatePolicy: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    };
    tokenService = {
      createAccessToken: jest.fn().mockReturnValue({
        accessToken: 'access.jwt',
        expiresIn: '15m',
      }),
      generateRefreshToken: jest.fn().mockReturnValue({
        rawToken: 'raw-refresh',
        tokenHash: 'hash-refresh',
        familyId: 'family-1',
        expiresAt: new Date(Date.now() + 86400000),
      }),
      hashRefreshToken: jest.fn().mockReturnValue('hash-refresh'),
      generateOneTimeToken: jest.fn().mockReturnValue({
        rawToken: 'challenge-raw',
        tokenHash: 'challenge-hash',
      }),
      hashOneTimeToken: jest.fn().mockReturnValue('reset-hash'),
    };

    const config = {
      get: (key: string, def?: unknown) => {
        if (key === 'ACCOUNT_LOCKOUT_ATTEMPTS') return 5;
        if (key === 'ACCOUNT_LOCKOUT_MINUTES') return 15;
        if (key === 'PASSWORD_RESET_TOKEN_TTL_MINUTES') return 30;
        if (key === 'ACTIVATION_TOKEN_TTL_HOURS') return 72;
        if (key === 'NODE_ENV') return 'test';
        return def;
      },
    } as ConfigService;

    const notificationService = {
      sendAuthNotification: jest.fn().mockResolvedValue(undefined),
    };

    const passwordResetRepository = {
      createResetToken: jest.fn().mockResolvedValue({ id: 'prt-1' }),
      findByTokenHash: jest.fn(),
      consumeResetToken: jest.fn().mockResolvedValue(undefined),
    };

    const authRepository = {
      findUserByEmailAndTenantCode: jest.fn(),
      findUniqueUserByEmail: jest.fn(),
      recordLoginHistory: jest.fn().mockResolvedValue(undefined),
    };

    const activationRepository = {
      createActivationToken: jest.fn().mockResolvedValue({ id: 'act-1' }),
      findByTokenHash: jest.fn(),
      activateAccount: jest.fn().mockResolvedValue(undefined),
    };

    const mfaService = {
      createLoginChallenge: jest.fn().mockResolvedValue({
        mfaRequired: true,
        mfaChallengeToken: 'challenge-token',
      }),
    };

    const registrationRepository = {
      activatePendingRoles: jest.fn().mockResolvedValue({ count: 0 }),
      createSelfRegisteredUser: jest.fn(),
      createRegistrationRequest: jest.fn(),
      findTenantByCode: jest.fn(),
      findUserByEmailTenant: jest.fn(),
    };

    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordService as unknown as PasswordService,
      tokenService as unknown as TokenService,
      notificationService as never,
      passwordResetRepository as never,
      authRepository as never,
      activationRepository as never,
      mfaService as never,
      registrationRepository as never,
      config,
      auditService as never,
    );

    (service as unknown as { _notif: typeof notificationService })._notif = notificationService;
    (service as unknown as { _prt: typeof passwordResetRepository })._prt = passwordResetRepository;
    (service as unknown as { _ar: typeof authRepository })._ar = authRepository;
    (service as unknown as { _act: typeof activationRepository })._act = activationRepository;
  });

  // ---------- LOGIN ----------

  it('logs in with valid credentials', async () => {
    prisma.user.findMany.mockResolvedValue([activeUser]);
    passwordService.compare.mockResolvedValue(true);

    const result = await service.login({
      email: 'admin@school.edu',
      password: 'ValidPass1!',
    });

    expect(result).toMatchObject({
      accessToken: 'access.jwt',
      refreshToken: 'raw-refresh',
      mfaRequired: false,
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokenHash: 'hash-refresh' }),
      }),
    );
    expect(prisma.loginHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: true }),
      }),
    );
  });

  it('rejects invalid password and increments failures', async () => {
    prisma.user.findMany.mockResolvedValue([activeUser]);
    passwordService.compare.mockResolvedValue(false);
    prisma.user.update.mockResolvedValue({ ...activeUser, failedLoginCount: 1 });

    await expect(
      service.login({ email: 'admin@school.edu', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unknown email without enumeration', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(
      service.login({ email: 'nobody@school.edu', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects inactive account', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...activeUser, status: 'INACTIVE' },
    ]);
    passwordService.compare.mockResolvedValue(true);

    await expect(
      service.login({ email: 'admin@school.edu', password: 'ValidPass1!' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects locked account', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        ...activeUser,
        status: 'LOCKED',
        lockedUntil: new Date(Date.now() + 60000),
      },
    ]);

    await expect(
      service.login({ email: 'admin@school.edu', password: 'ValidPass1!' }),
    ).rejects.toThrow(HttpException);
  });

  it('rejects suspended tenant', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        ...activeUser,
        tenant: { status: 'SUSPENDED', deletedAt: null },
      },
    ]);

    await expect(
      service.login({ email: 'admin@school.edu', password: 'ValidPass1!' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns MFA challenge when mfaEnabled', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...activeUser, mfaEnabled: true },
    ]);
    passwordService.compare.mockResolvedValue(true);

    const result = await service.login({
      email: 'admin@school.edu',
      password: 'ValidPass1!',
    });

    expect(result).toMatchObject({
      mfaRequired: true,
      mfaChallengeToken: 'challenge-token',
    });
  });

  it('resolves user by tenantCode', async () => {
    prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', code: 'demo' });
    prisma.user.findFirst.mockResolvedValue(activeUser);
    passwordService.compare.mockResolvedValue(true);

    const result = await service.login({
      email: 'admin@school.edu',
      password: 'ValidPass1!',
      tenantCode: 'demo',
    });

    expect(result).toMatchObject({ accessToken: 'access.jwt' });
    expect(prisma.user.findFirst).toHaveBeenCalled();
  });

  // ---------- REFRESH ----------

  it('rotates a valid refresh token', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      tokenHash: 'hash-refresh',
      familyId: 'family-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      deviceInfo: null,
      ipAddress: null,
      user: activeUser,
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        refreshToken: {
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const result = await service.refresh('raw-refresh');
    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBe('raw-refresh');
  });

  it('rejects revoked refresh token and revokes family', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      familyId: 'family-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      user: activeUser,
    });

    await expect(service.refresh('raw-refresh')).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('rejects unknown refresh token', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue(null);
    await expect(service.refresh('bad')).rejects.toThrow(UnauthorizedException);
  });

  // ---------- LOGOUT ----------

  it('revokes specific refresh token on logout', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-1',
      revokedAt: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });

    await service.logout(
      { userId: 'user-1', tenantId: 'tenant-1', email: 'a@x.com', personaType: 'STAFF' },
      'raw-refresh',
    );

    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('revokes all sessions when no refresh token provided', async () => {
    await service.logout({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'a@x.com',
      personaType: 'STAFF',
    });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          tenantId: 'tenant-1',
          revokedAt: null,
        }),
      }),
    );
  });

  // ---------- ME ----------

  it('returns safe profile for active user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@school.edu',
      personaType: 'STAFF',
      status: 'ACTIVE',
      mfaEnabled: false,
      activatedAt: new Date('2026-01-01'),
      lastLoginAt: new Date('2026-08-01'),
      tenant: { status: 'ACTIVE', deletedAt: null },
    });

    const me = await service.me({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@school.edu',
      personaType: 'STAFF',
    });

    expect(me.id).toBe('user-1');
    expect(me).not.toHaveProperty('passwordHash');
    expect(me).not.toHaveProperty('failedLoginCount');
  });

  it('rejects me for inactive user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...activeUser,
      status: 'INACTIVE',
      tenant: { status: 'ACTIVE', deletedAt: null },
    });

    await expect(
      service.me({
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'admin@school.edu',
        personaType: 'STAFF',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
  // ---------- FORGOT PASSWORD ----------

  it('forgotPassword returns same generic message for unknown email', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const res = await service.forgotPassword({ email: 'nobody@x.com' });
    expect(res.message).toContain('If an account exists');
  });

  it('forgotPassword returns same generic message for existing email', async () => {
    prisma.user.findMany.mockResolvedValue([activeUser]);
    const res = await service.forgotPassword({ email: 'admin@school.edu' });
    expect(res.message).toContain('If an account exists');
    expect((service as any)._prt.createResetToken).toHaveBeenCalled();
  });

  it('forgotPassword does not enumerate suspended tenant', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...activeUser, tenant: { status: 'SUSPENDED', deletedAt: null } },
    ]);
    const res = await service.forgotPassword({ email: 'admin@school.edu' });
    expect(res.message).toContain('If an account exists');
  });

  // ---------- RESET PASSWORD ----------

  it('resetPassword succeeds with valid token and strong password', async () => {
    (service as any)._prt.findByTokenHash.mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'reset-hash',
      tenantId: 'tenant-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: activeUser,
    });

    const res = await service.resetPassword({
      token: 'raw-reset',
      newPassword: 'NewSecurePass1!',
      confirmPassword: 'NewSecurePass1!',
    });

    expect(res.message).toContain('updated successfully');
    expect(passwordService.assertPolicy).toHaveBeenCalled();
    expect(passwordService.hash).toHaveBeenCalled();
    expect((service as any)._prt.consumeResetToken).toHaveBeenCalled();
  });

  it('resetPassword rejects mismatched passwords', async () => {
    await expect(
      service.resetPassword({
        token: 'raw',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'OtherPass1!',
      }),
    ).rejects.toThrow();
  });

  it('resetPassword rejects invalid token', async () => {
    (service as any)._prt.findByTokenHash.mockResolvedValue(null);
    await expect(
      service.resetPassword({
        token: 'bad',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('resetPassword rejects expired token', async () => {
    (service as any)._prt.findByTokenHash.mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'reset-hash',
      tenantId: 'tenant-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60000),
      user: activeUser,
    });
    await expect(
      service.resetPassword({
        token: 'raw',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('resetPassword rejects already-used token', async () => {
    (service as any)._prt.findByTokenHash.mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'reset-hash',
      tenantId: 'tenant-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      user: activeUser,
    });
    await expect(
      service.resetPassword({
        token: 'raw',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('resetPassword rejects cross-tenant token mismatch', async () => {
    (service as any)._prt.findByTokenHash.mockResolvedValue({
      id: 'prt-1',
      tokenHash: 'reset-hash',
      tenantId: 'tenant-OTHER',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: activeUser, // tenant-1
    });
    await expect(
      service.resetPassword({
        token: 'raw',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ---------- ACTIVATE ACCOUNT ----------

  const pendingUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'pending@school.edu',
    personaType: 'STAFF',
    status: 'INACTIVE',
    activatedAt: null,
    deletedAt: null,
    tenant: { status: 'ACTIVE', deletedAt: null },
  };

  it('activates pending account with valid token and strong password', async () => {
    (service as any)._act.findByTokenHash.mockResolvedValue({
      id: 'act-1',
      tokenHash: 'act-hash',
      tenantId: 'tenant-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: pendingUser,
    });
    tokenService.hashOneTimeToken = jest.fn().mockReturnValue('act-hash');

    const res = await service.activateAccount({
      token: 'raw-act',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
    });

    expect(res.message).toContain('activated');
    expect(passwordService.assertPolicy).toHaveBeenCalled();
    expect(passwordService.hash).toHaveBeenCalled();
    expect((service as any)._act.activateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('rejects activation with password mismatch', async () => {
    await expect(
      service.activateAccount({
        token: 'raw',
        password: 'SecurePass1!',
        confirmPassword: 'OtherPass1!',
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid activation token', async () => {
    (service as any)._act.findByTokenHash.mockResolvedValue(null);
    tokenService.hashOneTimeToken = jest.fn().mockReturnValue('x');
    await expect(
      service.activateAccount({
        token: 'bad',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired activation token', async () => {
    (service as any)._act.findByTokenHash.mockResolvedValue({
      id: 'act-1',
      tenantId: 'tenant-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60000),
      user: pendingUser,
    });
    tokenService.hashOneTimeToken = jest.fn().mockReturnValue('act-hash');
    await expect(
      service.activateAccount({
        token: 'raw',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects already-used activation token', async () => {
    (service as any)._act.findByTokenHash.mockResolvedValue({
      id: 'act-1',
      tenantId: 'tenant-1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      user: pendingUser,
    });
    tokenService.hashOneTimeToken = jest.fn().mockReturnValue('act-hash');
    await expect(
      service.activateAccount({
        token: 'raw',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects activation for already-active account', async () => {
    (service as any)._act.findByTokenHash.mockResolvedValue({
      id: 'act-1',
      tenantId: 'tenant-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: { ...pendingUser, status: 'ACTIVE', activatedAt: new Date() },
    });
    tokenService.hashOneTimeToken = jest.fn().mockReturnValue('act-hash');
    await expect(
      service.activateAccount({
        token: 'raw',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects cross-tenant activation token misuse', async () => {
    (service as any)._act.findByTokenHash.mockResolvedValue({
      id: 'act-1',
      tenantId: 'tenant-OTHER',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: pendingUser, // tenant-1
    });
    tokenService.hashOneTimeToken = jest.fn().mockReturnValue('act-hash');
    await expect(
      service.activateAccount({
        token: 'raw',
        password: 'SecurePass1!',
        confirmPassword: 'SecurePass1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

});
