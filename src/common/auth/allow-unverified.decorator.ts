import { SetMetadata } from '@nestjs/common'

export const ALLOW_UNVERIFIED_KEY = 'allow_unverified'

/**
 * Marks routes an organization may use BEFORE its institution application is approved
 * (sign-in/session, onboarding and verification itself). Every other authenticated
 * route is blocked by ApprovalGuard until the superadmin approves.
 */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true)
