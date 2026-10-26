// backend/src/common/auth/rbac.decorators.ts
import { SetMetadata } from '@nestjs/common'
import { PlatformRole } from '@prisma/client'

export const REQUIRE_PLATFORM_ROLE_KEY = 'require_platform_role'
export const REQUIRE_PERMISSION_KEY = 'require_permission'
export const REQUIRE_PRODUCT_ENTITLEMENT_KEY = 'require_product_entitlement'

/**
 * Enforce minimum or specific Platform Authority level: SuperAdmin, OrganizationAdmin, CampusAdmin, Member
 */
export const RequirePlatformRole = (...roles: (PlatformRole | 'SuperAdmin' | 'OrganizationAdmin' | 'CampusAdmin' | 'Member')[]) =>
  SetMetadata(REQUIRE_PLATFORM_ROLE_KEY, roles)

/**
 * Enforce granular permission key e.g. 'academics.programs.create', 'finance.fee.collect'
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions)

/**
 * Enforce that the caller's organization has active or trial entitlement for this product
 */
export const RequireProductEntitlement = (productId: string) =>
  SetMetadata(REQUIRE_PRODUCT_ENTITLEMENT_KEY, productId)
