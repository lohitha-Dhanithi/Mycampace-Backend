import { UnauthorizedException } from '@nestjs/common'
import { createHash } from 'crypto'
import { AuthService } from './auth.service'

const sha = (t: string) => createHash('sha256').update(t).digest('hex')
const future = () => new Date(Date.now() + 3600_000)
const past = () => new Date(Date.now() - 3600_000)

function build() {
  const prisma: any = {
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        organizationId: 'o1',
        email: 'a@b.in',
        name: 'A',
        platformRole: 'OrganizationAdmin',
        status: 'Active',
        productRoles: [],
        organization: { onboardingStatus: 'Pending', onboardingStep: 1 },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  }
  const jwt: any = { signAsync: jest.fn().mockResolvedValue('new-access-jwt') }
  const config: any = { get: (_k: string, d?: unknown) => d }
  const catalog: any = { ensureCatalog: jest.fn().mockResolvedValue(undefined) }
  const service = new AuthService(prisma, {} as any, jwt, config, catalog)
  return { service, prisma, jwt }
}

describe('AuthService.refreshSession', () => {
  it('rejects when no refresh token is supplied', async () => {
    const { service, prisma } = build()
    await expect(service.refreshSession(undefined)).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(service.refreshSession(null)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled()
  })

  it('rejects an unknown token', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.findUnique.mockResolvedValue(null)
    await expect(service.refreshSession('nope')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('looks tokens up by hash, never by raw value', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.findUnique.mockResolvedValue(null)
    await service.refreshSession('raw-token').catch(() => undefined)
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: sha('raw-token') } })
  })

  it('rejects an expired token without revoking other sessions', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: null, expiresAt: past() })
    await expect(service.refreshSession('old')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
  })

  it('treats reuse of an already-rotated token as theft: revokes ALL active sessions of that user', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      revokedAt: new Date(),
      expiresAt: future(),
    })
    await expect(service.refreshSession('stolen')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(prisma.refreshToken.create).not.toHaveBeenCalled()
  })

  it('loses a concurrent rotation race: only one caller may claim the token', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: null, expiresAt: future() })
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 }) // another request already claimed it
    await expect(service.refreshSession('racy')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.refreshToken.create).not.toHaveBeenCalled()
  })

  it('rotates: claims the old token atomically and issues a new access + refresh pair', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 't1', userId: 'u1', revokedAt: null, expiresAt: future() })
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

    const out: any = await service.refreshSession('good')

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(out.accessToken).toBe('new-access-jwt')
    expect(out.refreshToken).toEqual(expect.any(String))
    expect(out.refreshToken).not.toBe('good')
    expect(out.expiresIn).toBe(900)
    // The new refresh token is stored hashed, not raw.
    const stored = prisma.refreshToken.create.mock.calls[0][0].data
    expect(stored.tokenHash).toBe(sha(out.refreshToken))
    expect(stored.tokenHash).not.toBe(out.refreshToken)
  })
})

describe('AuthService.signUpWithEmail', () => {
  it('does not leave a half-created account behind when the session cannot be issued', async () => {
    const { service, prisma, jwt } = build()
    prisma.user.findUnique.mockResolvedValueOnce(null) // email not taken
    prisma.organization = { delete: jest.fn().mockResolvedValue({}) }
    prisma.$transaction = jest.fn().mockResolvedValue({ id: 'u-new', organizationId: 'org-new' })
    jwt.signAsync.mockRejectedValue(new Error('secretOrPrivateKey must have a value'))

    await expect(service.signUpWithEmail({ name: 'A', email: 'new@b.in', password: 'Secret123' } as any)).rejects.toThrow('secretOrPrivateKey')
    expect(prisma.organization.delete).toHaveBeenCalledWith({ where: { id: 'org-new' } })
  })
})

describe('AuthService.signInWithEmail (no session while under review)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bcrypt = require('bcryptjs')
  const hash = bcrypt.hashSync('Correct#Pass1', 4)

  function buildSignIn(verificationStatus: string, platformRole = 'OrganizationAdmin') {
    const ctx = build()
    ctx.prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args.where.email) return { id: 'u1', passwordHash: hash, status: 'Active', platformRole, productRoles: [] }
      if (args.select?.organization) return { platformRole, organization: { verificationStatus } }
      // issueTokens() full user lookup
      return {
        id: 'u1', organizationId: 'o1', email: 'a@b.in', name: 'A', platformRole, status: 'Active', productRoles: [],
        organization: { onboardingStatus: 'Pending', onboardingStep: 1, verificationStatus, verificationNote: null, verificationSubmittedAt: null },
      }
    })
    return ctx
  }
  const creds = { email: 'a@b.in', password: 'Correct#Pass1' }

  it('refuses to issue a session while the application is Submitted, with a clear reason', async () => {
    const { service, jwt } = buildSignIn('Submitted')
    await expect(service.signInWithEmail(creds)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VERIFICATION_PENDING', statusCode: 403 }),
    })
    expect(jwt.signAsync).not.toHaveBeenCalled() // no token was minted
  })

  it.each(['Draft', 'Rejected', 'Approved'])('still signs in when the application is %s', async (status) => {
    const { service } = buildSignIn(status)
    await expect(service.signInWithEmail(creds)).resolves.toMatchObject({ accessToken: 'new-access-jwt' })
  })

  it('never blocks a SuperAdmin', async () => {
    const { service } = buildSignIn('Submitted', 'SuperAdmin')
    await expect(service.signInWithEmail(creds)).resolves.toBeDefined()
  })

  it('does not reveal the application status to someone with a wrong password (generic 401)', async () => {
    const { service } = buildSignIn('Submitted')
    await expect(service.signInWithEmail({ ...creds, password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException)
  })
})

describe('AuthService.logout', () => {
  it('revokes only the presented token, by hash', async () => {
    const { service, prisma } = build()
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })
    await expect(service.logout('tok')).resolves.toEqual({ success: true })
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: sha('tok'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('succeeds (idempotent) with no token', async () => {
    const { service, prisma } = build()
    await expect(service.logout(undefined)).resolves.toEqual({ success: true })
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled()
  })
})
