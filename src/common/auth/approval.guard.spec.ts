import { ForbiddenException } from '@nestjs/common'
import { ApprovalGuard } from './approval.guard'
import { ALLOW_UNVERIFIED_KEY } from './allow-unverified.decorator'
import { IS_PUBLIC_KEY } from './public.decorator'

function build(flags: Record<string, boolean> = {}, orgStatus: string | null = 'Draft') {
  const reflector: any = { getAllAndOverride: (key: string) => flags[key] ?? false }
  const prisma: any = {
    organization: { findUnique: jest.fn().mockResolvedValue(orgStatus ? { verificationStatus: orgStatus } : null) },
  }
  const guard = new ApprovalGuard(reflector, prisma)
  const ctx = (user: any) =>
    ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any
  return { guard, prisma, ctx }
}

const admin = { userId: 'u1', organizationId: 'o1', platformRole: 'OrganizationAdmin' }

describe('ApprovalGuard (no ERP access before approval)', () => {
  it.each(['Draft', 'Submitted', 'Rejected'])('blocks an organization admin whose application is %s', async (status) => {
    const { guard, ctx } = build({}, status)
    await expect(guard.canActivate(ctx(admin))).rejects.toBeInstanceOf(ForbiddenException)
    await expect(guard.canActivate(ctx(admin))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ORG_NOT_APPROVED', verificationStatus: status }),
    })
  })

  it('allows the organization admin once Approved', async () => {
    const { guard, ctx } = build({}, 'Approved')
    await expect(guard.canActivate(ctx(admin))).resolves.toBe(true)
  })

  it('blocks when the organization cannot be found (fail closed)', async () => {
    const { guard, ctx } = build({}, null)
    await expect(guard.canActivate(ctx(admin))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('does not block a SuperAdmin, and does not even query the organization', async () => {
    const { guard, ctx, prisma } = build({}, 'Draft')
    await expect(guard.canActivate(ctx({ ...admin, platformRole: 'SuperAdmin' }))).resolves.toBe(true)
    expect(prisma.organization.findUnique).not.toHaveBeenCalled()
  })

  it('lets @AllowUnverified routes through (sign-in session, onboarding, verification)', async () => {
    const { guard, ctx, prisma } = build({ [ALLOW_UNVERIFIED_KEY]: true }, 'Draft')
    await expect(guard.canActivate(ctx(admin))).resolves.toBe(true)
    expect(prisma.organization.findUnique).not.toHaveBeenCalled()
  })

  it('lets @Public routes through', async () => {
    const { guard, ctx } = build({ [IS_PUBLIC_KEY]: true }, 'Draft')
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true)
  })

  it('blocks a Campus Admin / Member of an unapproved organization too', async () => {
    const { guard, ctx } = build({}, 'Submitted')
    await expect(guard.canActivate(ctx({ ...admin, platformRole: 'Member' }))).rejects.toBeInstanceOf(ForbiddenException)
  })
})
