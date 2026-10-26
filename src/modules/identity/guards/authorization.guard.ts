import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/require-role.decorator';
import { AuthorizationService } from '../services/authorization.service';
import type { AuthContext } from '../interfaces/auth-context.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Runs after JwtAuthGuard. Deny by default when permissions/roles metadata present.
 * Tenant context always from AuthContext — never from request body.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!requiredPermissions.length && !requiredRoles.length) {
      // No authorization metadata — authentication alone is enough for this route
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthContext }>();
    const user = request.user;
    if (!user?.userId || !user?.tenantId) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    const snapshot = await this.authorization.getSnapshot(
      user.userId,
      user.tenantId,
    );

    if (requiredRoles.length) {
      const ok = requiredRoles.some((r) => snapshot.roles.includes(r));
      if (!ok) {
        throw new ForbiddenException({
          code: 'AUTH_ROLE_REQUIRED',
          message: 'You do not have permission to perform this action.',
        });
      }
    }

    if (requiredPermissions.length) {
      const ok = requiredPermissions.some((p) =>
        snapshot.permissions.includes(p),
      );
      if (!ok) {
        throw new ForbiddenException({
          code: 'AUTH_PERMISSION_REQUIRED',
          message: 'You do not have permission to perform this action.',
        });
      }
    }

    // Attach snapshot for controllers that need it (read-only)
    (request as { authorization?: typeof snapshot }).authorization = snapshot;

    return true;
  }
}
