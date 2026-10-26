import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../interfaces/auth-context.interface';

/**
 * Extract the authenticated AuthContext from the request.
 * Requires JwtAuthGuard to have run successfully.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthContext }>();
    return request.user;
  },
);
