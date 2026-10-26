import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('allows public routes without authentication', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });

  it('handleRequest throws when user is missing', () => {
    expect(() => guard.handleRequest(null, null as never, undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('handleRequest returns user when present', () => {
    const user = { userId: 'u1', tenantId: 't1', email: 'a@x.com', personaType: 'STAFF' };
    expect(guard.handleRequest(null, user, undefined)).toEqual(user);
  });
});
