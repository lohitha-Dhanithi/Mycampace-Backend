import {
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { OnboardingStatus, PlatformRole, VerificationStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'
import { ProductCatalogService } from '@/modules/catalog/product-catalog.service'
import { EmailSignInDto, SignUpDto, GoogleAuthDto } from './auth.dto'
import { toAuthUser } from './auth.mapper'
import { resolveJwtSecret } from './jwt-secret'

const BCRYPT_ROUNDS = 12
/** Longer than Chrome's 1-per-minute timer throttling of background tabs, so hidden tabs are not dropped. */
const TAB_STALE_MS = 90_000
/** Grace after the last tab of a session goes away; a page reload pings again well within it. */
const TAB_CLOSE_LOGOUT_MS = 10_000
const TAB_SWEEP_MS = 2_000

interface TabSession {
  tabs: Map<string, number>
  emptySince?: number
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  /**
   * Open browser tabs per session, keyed by refresh-token hash so heartbeats of a tracked session need
   * no database round trip. Only sessions that have pinged are tracked.
   */
  private readonly tabSessions = new Map<string, TabSession>()
  private tabSweeper: ReturnType<typeof setInterval> | null = null

  onModuleInit() {
    this.tabSweeper = setInterval(() => void this.sweepTabSessions(), TAB_SWEEP_MS)
    this.tabSweeper.unref?.()
  }

  onModuleDestroy() {
    if (this.tabSweeper) clearInterval(this.tabSweeper)
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly catalog: ProductCatalogService,
  ) {}

  private userInclude() {
    return {
      productRoles: true,
      organization: {
        select: {
          onboardingStatus: true,
          onboardingStep: true,
          verificationStatus: true,
          verificationNote: true,
          verificationSubmittedAt: true,
        },
      },
    }
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private accessTtlSeconds() {
    const raw = this.config.get<string>('JWT_EXPIRATION', '15m')
    if (raw.endsWith('m')) return parseInt(raw, 10) * 60
    if (raw.endsWith('h')) return parseInt(raw, 10) * 3600
    if (raw.endsWith('d')) return parseInt(raw, 10) * 86400
    return 900
  }

  private refreshTtlDays() {
    return parseInt(this.config.get<string>('JWT_REFRESH_EXPIRATION_DAYS', '30'), 10)
  }

  private async issueTokens(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    })
    if (!user) throw new UnauthorizedException('User not found.')
    return this.issueTokensForUser(user)
  }

  /** Issue a session for a user row that already includes productRoles + organization. */
  private async issueTokensForUser(user: {
    id: string
    organizationId: string
    email: string
    platformRole: PlatformRole
    name: string
    campusId: string | null
    avatarUrl: string | null
    authProvider: string
    productRoles: { productId: string; roleName: string }[]
    organization?: {
      onboardingStatus: OnboardingStatus
      onboardingStep: number
      verificationStatus: VerificationStatus
      verificationNote: string | null
      verificationSubmittedAt: Date | null
    } | null
  }) {
    const refreshToken = randomBytes(48).toString('hex')
    const refreshHash = this.hashRefreshToken(refreshToken)
    const expiresAt = new Date(Date.now() + this.refreshTtlDays() * 86400000)

    const session = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt,
      },
      select: { id: true },
    })

    // `sid` binds the access token to its refresh session, so revoking the session ends it at once.
    const payload = {
      sub: user.id,
      sid: session.id,
      orgId: user.organizationId,
      email: user.email,
      platformRole: user.platformRole,
    }

    const accessToken = await this.jwt.signAsync(payload, {
      secret: resolveJwtSecret(this.config),
      expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m'),
    })

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return {
      user: toAuthUser(user as Parameters<typeof toAuthUser>[0]),
      accessToken,
      refreshToken,
      sessionId: session.id,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds(),
    }
  }

  async signUpWithEmail(dto: SignUpDto) {
    await this.catalog.ensureCatalog()

    const email = dto.email.trim().toLowerCase()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ConflictException('An account with this email already exists.')
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
    const orgCode = `ORG-${randomBytes(3).toString('hex').toUpperCase()}`

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `${dto.name.trim()}'s Organization`,
          code: orgCode,
          type: 'School',
          country: 'India',
          state: 'TBD',
          city: 'TBD',
          onboardingStatus: OnboardingStatus.Pending,
          onboardingStep: 1,
        },
      })

      return tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          name: dto.name.trim(),
          passwordHash,
          platformRole: PlatformRole.OrganizationAdmin,
          authProvider: 'email',
          productRoles: {
            create: [
              { productId: 'academics', roleName: 'Administrator' },
              { productId: 'lms', roleName: 'Administrator' },
            ],
          },
        },
        include: this.userInclude(),
      })
    })

    // The account is committed above; if the session cannot be issued (e.g. misconfigured JWT secret),
    // remove it again so the person is not left with an account that exists but never logged in.
    try {
      const session = await this.issueTokensForUser(user)
      return { ...session, message: 'Account created. Complete onboarding to activate your workspace.' }
    } catch (err) {
      await this.discardNewAccount(user.organizationId)
      throw err
    }
  }

  /** Compensating delete for an organization created moments ago (cascades to its user and roles). */
  private async discardNewAccount(organizationId: string) {
    await this.prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined)
  }

  async signInWithEmail(dto: EmailSignInDto) {
    const email = dto.email.trim().toLowerCase()
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { productRoles: true },
    })
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid email or password.')
    if (user.status !== 'Active') {
      throw new UnauthorizedException('Account is inactive. Contact your administrator.')
    }

    await this.assertNotUnderReview(user.id)
    return this.issueTokens(user.id)
  }

  /**
   * Credentials are already proven at this point, so telling the person why they cannot sign in leaks nothing.
   * While the application is awaiting a superadmin decision, no session is issued at all.
   * Draft (still onboarding), Rejected (must fix and resubmit) and Approved are allowed;
   * ERP access itself is enforced separately by ApprovalGuard.
   */
  private async assertNotUnderReview(userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, organization: { select: { verificationStatus: true } } },
    })
    if (row && row.platformRole !== PlatformRole.SuperAdmin && row.organization?.verificationStatus === 'Submitted') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'VERIFICATION_PENDING',
        message:
          'Your institution application is under review. You will be able to sign in once it has been approved.',
      })
    }
  }

  async signInWithGoogle(dto: GoogleAuthDto) {
    if (!dto.token && !dto.idToken) {
      throw new UnauthorizedException('Google identity token is required.')
    }
    const email = (dto.email || 'vikram.aditya@abcschool.edu.in').trim().toLowerCase()
    let user = await this.prisma.user.findUnique({ where: { email } })

    if (!user) {
      const orgCode = `ORG-${randomBytes(3).toString('hex').toUpperCase()}`
      user = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: 'Google SSO Organization',
            code: orgCode,
            type: 'School',
            country: 'India',
            state: 'TBD',
            city: 'TBD',
            onboardingStatus: OnboardingStatus.Pending,
            onboardingStep: 1,
          },
        })
        return tx.user.create({
          data: {
            organizationId: organization.id,
            email,
            name: email.split('@')[0],
            platformRole: PlatformRole.OrganizationAdmin,
            authProvider: 'google',
          },
        })
      })
    }

    await this.assertNotUnderReview(user.id)
    return this.issueTokens(user.id)
  }

  async refreshSession(refreshToken?: string | null) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is invalid or expired.')
    const tokenHash = this.hashRefreshToken(refreshToken)
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    })
    if (!stored) throw new UnauthorizedException('Refresh token is invalid or expired.')

    // A rotated (already revoked) token being presented again indicates theft/replay:
    // revoke every active session of that user.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      throw new UnauthorizedException('Refresh token is invalid or expired.')
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired.')
    }

    // Atomic claim: only one concurrent request may rotate this token.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (claimed.count !== 1) throw new UnauthorizedException('Refresh token is invalid or expired.')

    const session = await this.issueTokens(stored.userId)
    // Rotation replaces the session row; open tabs carry over to the new one.
    const tracked = this.tabSessions.get(tokenHash)
    if (tracked) {
      this.tabSessions.delete(tokenHash)
      this.tabSessions.set(this.hashRefreshToken(session.refreshToken), tracked)
    }
    return session
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { success: true }
    const tokenHash = this.hashRefreshToken(refreshToken)
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    this.tabSessions.delete(tokenHash)
    return { success: true }
  }

  /**
   * Tab heartbeat for the browser session identified by its refresh cookie. When every tab of that
   * session has hidden (or stopped pinging) for TAB_CLOSE_LOGOUT_MS, the sweeper revokes it.
   * Only this browser's session is affected; other devices and browsers keep theirs.
   */
  async recordTabLifecycle(refreshToken: string | null | undefined, tabId: string, phase: 'ping' | 'hide') {
    if (!refreshToken) return
    const tokenHash = this.hashRefreshToken(refreshToken)
    let entry = this.tabSessions.get(tokenHash)
    if (!entry) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { revokedAt: true, expiresAt: true },
      })
      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return
      entry = this.tabSessions.get(tokenHash) ?? { tabs: new Map<string, number>() }
    }
    if (phase === 'ping') {
      entry.tabs.set(tabId, Date.now())
      entry.emptySince = undefined
    } else {
      entry.tabs.delete(tabId)
      if (entry.tabs.size === 0) entry.emptySince ??= Date.now()
    }
    this.tabSessions.set(tokenHash, entry)
  }

  private async sweepTabSessions() {
    const now = Date.now()
    const expired: string[] = []
    for (const [tokenHash, entry] of this.tabSessions) {
      for (const [tabId, lastPing] of entry.tabs) {
        if (now - lastPing > TAB_STALE_MS) entry.tabs.delete(tabId)
      }
      if (entry.tabs.size > 0) continue
      entry.emptySince ??= now
      if (now - entry.emptySince >= TAB_CLOSE_LOGOUT_MS) expired.push(tokenHash)
    }
    if (!expired.length) return
    // Deleted rather than revoked: the closed browser still holds the cookie, and presenting a revoked
    // token is treated as theft by refreshSession(), which would sign the user out on every device.
    try {
      await this.prisma.refreshToken.deleteMany({ where: { tokenHash: { in: expired } } })
      expired.forEach((hash) => this.tabSessions.delete(hash))
    } catch {
      // Database unavailable: keep tracking and retry on the next sweep.
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    })
    if (!user) throw new UnauthorizedException('User not found.')
    return toAuthUser(user)
  }
}
