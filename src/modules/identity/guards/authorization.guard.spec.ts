import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationGuard } from './authorization.guard';
import { AuthorizationService } from '../services/authorization.service';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('AuthorizationGuard', () => {
  let guard: AuthorizationGuard;
  let reflector: Reflector;
  const authorization = {
    getSnapshot: jest.fn(),
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AuthorizationGuard(
      reflector,
      authorization as unknown as AuthorizationService,
    );
    jest.clearAllMocks();
  });

  const ctx = (user?: { userId: string; tenantId: string }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  it('allows public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('allows authenticated routes with no permission metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(
      guard.canActivate(ctx({ userId: 'u1', tenantId: 't1' })),
    ).resolves.toBe(true);
  });

  it('denies when permission required but missing', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['admission.manage'];
      return undefined;
    });
    authorization.getSnapshot.mockResolvedValue({
      userId: 'u1',
      tenantId: 't1',
      roles: ['SCHOOL_TEACHER'],
      permissions: ['student.read'],
    });
    await expect(
      guard.canActivate(ctx({ userId: 'u1', tenantId: 't1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows when required permission present', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['student.read'];
      return undefined;
    });
    authorization.getSnapshot.mockResolvedValue({
      userId: 'u1',
      tenantId: 't1',
      roles: ['SCHOOL_TEACHER'],
      permissions: ['student.read', 'institution.read'],
    });
    await expect(
      guard.canActivate(ctx({ userId: 'u1', tenantId: 't1' })),
    ).resolves.toBe(true);
  });

  it('rejects unauthenticated when permission required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['student.read'];
      return undefined;
    });
    await expect(guard.canActivate(ctx(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
