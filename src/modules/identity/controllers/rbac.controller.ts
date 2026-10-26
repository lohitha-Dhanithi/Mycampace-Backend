/** @deprecated Public Identity APIs are served by identity-service via gateway. Do not re-register these controllers on platform. */
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthorizationService } from '../services/authorization.service';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthContext } from '../interfaces/auth-context.interface';

/**
 * Secured catalog endpoints for authorized administrators.
 * Not public. Registration options remain on /auth/registration-options.
 */
@ApiTags('RBAC')
@ApiBearerAuth()
@Controller()
export class RbacController {
  constructor(private readonly authorization: AuthorizationService) {}

  @Get('permissions')
  @RequirePermission('identity.permission.read')
  @ApiOperation({ summary: 'List active permission catalog' })
  listPermissions() {
    return this.authorization.listPermissionCatalog();
  }

  @Get('roles')
  @RequirePermission('identity.role.read')
  @ApiOperation({ summary: 'List active system roles' })
  listRoles() {
    return this.authorization.listRoleCatalog();
  }

  @Get('auth/authorization')
  @ApiOperation({
    summary: 'Effective roles and permissions for the current user (tenant-scoped)',
  })
  async myAuthorization(@CurrentUser() user: AuthContext) {
    return this.authorization.getSnapshot(user.userId, user.tenantId);
  }
}
