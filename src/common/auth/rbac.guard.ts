// backend/src/common/auth/rbac.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PlatformRole } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'
import { IS_PUBLIC_KEY } from './public.decorator'
import {
  REQUIRE_PLATFORM_ROLE_KEY,
  REQUIRE_PERMISSION_KEY,
  REQUIRE_PRODUCT_ENTITLEMENT_KEY,
} from './rbac.decorators'
import { AuthenticatedUser } from './current-user.decorator'

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Skip if endpoint is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const user: AuthenticatedUser | undefined = request.user

    if (!user) {
      throw new UnauthorizedException('Authentication required for RBAC evaluation.')
    }

    const { organizationId, platformRole } = user

    // 2. Platform Authority Check
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PLATFORM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (requiredRoles && requiredRoles.length > 0) {
      // SuperAdmin has platform-wide authority
      const isSuperAdmin = platformRole === 'SuperAdmin' || platformRole === PlatformRole.SuperAdmin
      const hasRequiredRole = isSuperAdmin || requiredRoles.includes(platformRole)

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `Insufficient platform authority. Required: [${requiredRoles.join(', ')}], current: ${platformRole}.`,
        )
      }
    }

    // 3. Tenant Boundary & Cross-Tenant Access Protection
    const isSuperAdmin = platformRole === 'SuperAdmin' || platformRole === PlatformRole.SuperAdmin
    if (!isSuperAdmin) {
      const requestedOrgId =
        request.params?.organizationId ||
        request.query?.organizationId ||
        request.body?.organizationId

      if (requestedOrgId && requestedOrgId !== organizationId) {
        throw new ForbiddenException(
          'Cross-tenant access forbidden. You cannot access or modify records of another organization.',
        )
      }
    }

    // 4. Product Entitlement Check
    const requiredProduct = this.reflector.getAllAndOverride<string>(
      REQUIRE_PRODUCT_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (requiredProduct && !isSuperAdmin) {
      const entitlement = await this.prisma.productEntitlement.findUnique({
        where: {
          organizationId_productId: {
            organizationId,
            productId: requiredProduct,
          },
        },
      })

      if (!entitlement || (entitlement.status !== 'Active' && entitlement.status !== 'Trial')) {
        throw new ForbiddenException(
          `Product "${requiredProduct}" is not active or entitled for your organization.`,
        )
      }
    }

    // 5. Granular Permissions Check
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (requiredPermissions && requiredPermissions.length > 0 && !isSuperAdmin) {
      // OrganizationAdmin has broad authority over organization resources
      if (platformRole === 'OrganizationAdmin' || platformRole === PlatformRole.OrganizationAdmin) {
        return true
      }

      // Check if user has roles providing these permissions
      const userProductRoles = await this.prisma.userProductRole.findMany({
        where: { userId: user.userId },
        include: { role: true },
      })

      const userGrantedPermissions = new Set<string>()
      for (const upr of userProductRoles) {
        if (upr.role && Array.isArray(upr.role.permissions)) {
          for (const p of upr.role.permissions) {
            userGrantedPermissions.add(p)
          }
        }
      }

      // If user has direct role or matching permissions
      const hasAllRequired = requiredPermissions.every((perm) =>
        userGrantedPermissions.has(perm),
      )

      if (!hasAllRequired && userGrantedPermissions.size > 0) {
        throw new ForbiddenException(
          `Missing required permission(s): ${requiredPermissions.join(', ')}`,
        )
      }
    }

    return true
  }
}
