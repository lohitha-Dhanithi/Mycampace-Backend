import { OnboardingStatus, PlatformRole, User, VerificationStatus } from '@prisma/client'

type UserWithRoles = User & {
  productRoles: { productId: string; roleName: string }[]
  organization?: {
    onboardingStatus: OnboardingStatus
    onboardingStep: number
    verificationStatus: VerificationStatus
    verificationNote: string | null
    verificationSubmittedAt: Date | null
  }
}

export function mapPlatformRoleLabel(role: PlatformRole) {
  switch (role) {
    case PlatformRole.OrganizationAdmin:
      return 'Organization Admin'
    case PlatformRole.CampusAdmin:
      return 'Campus Admin'
    default:
      return 'Member'
  }
}

export function toAuthUser(user: UserWithRoles) {
  const productRoles: Record<string, string> = {}
  user.productRoles.forEach((entry) => {
    productRoles[entry.productId] = entry.roleName
  })

  const onboardingRequired =
    user.organization?.onboardingStatus !== OnboardingStatus.Completed

  // Decided here, on the server, from the stored verification state. The UI only reads it.
  const verificationStatus = user.organization?.verificationStatus ?? VerificationStatus.Draft
  const accessLevel =
    user.platformRole === PlatformRole.SuperAdmin
      ? 'SUPERADMIN'
      : verificationStatus === VerificationStatus.Approved
        ? 'INSTITUTION_ADMIN'
        : 'APPLICANT_RESTRICTED'

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId: user.organizationId,
    campusId: user.campusId,
    platformRole: mapPlatformRoleLabel(user.platformRole),
    role:
      user.platformRole === PlatformRole.SuperAdmin
        ? 'Platform Superadmin'
        : user.platformRole === PlatformRole.OrganizationAdmin
          ? 'Super Admin'
          : 'Staff',
    avatarUrl: user.avatarUrl,
    avatar: user.avatarUrl,
    authProvider: user.authProvider,
    productRoles,
    accessLevel,
    verification: {
      status: verificationStatus,
      note: user.organization?.verificationNote ?? null,
      submittedAt: user.organization?.verificationSubmittedAt ?? null,
    },
    onboarding: {
      required: onboardingRequired,
      status: user.organization?.onboardingStatus || OnboardingStatus.Pending,
      step: user.organization?.onboardingStep || 1,
    },
  }
}
