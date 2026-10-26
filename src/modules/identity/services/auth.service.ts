import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import type { AuthContext } from '../interfaces/auth-context.interface';
import { AuthTokensDto, MeResponseDto } from '../dto/auth-response.dto';
import { NotificationService } from './notification.service';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
import { AuthRepository } from '../repositories/auth.repository';
import { ActivationRepository } from '../repositories/activation.repository';
import { MfaService } from './mfa.service';
import { RegistrationRepository } from '../repositories/registration.repository';
import { ActivateAccountDto } from '../dto/activate-account.dto';
import { AuditService } from '../../audit/services/audit.service';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

@Injectable()
export class AuthService {
  private readonly lockoutAttempts: number;
  private readonly lockoutMinutes: number;
  private readonly resetTtlMinutes: number;
  private readonly activationTtlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly notificationService: NotificationService,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly authRepository: AuthRepository,
    private readonly activationRepository: ActivationRepository,
    private readonly mfaService: MfaService,
    private readonly registrationRepository: RegistrationRepository,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.lockoutAttempts = this.config.get<number>('ACCOUNT_LOCKOUT_ATTEMPTS', 5);
    this.lockoutMinutes = this.config.get<number>('ACCOUNT_LOCKOUT_MINUTES', 15);
    this.resetTtlMinutes = this.config.get<number>('PASSWORD_RESET_TOKEN_TTL_MINUTES', 30);
    this.activationTtlHours = this.config.get<number>('ACTIVATION_TOKEN_TTL_HOURS', 72);
  }

  // -------------------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------------------

  async login(
    dto: LoginDto,
    meta: RequestMeta = {},
  ): Promise<AuthTokensDto | { mfaRequired: true; mfaChallengeToken: string }> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.resolveUserForLogin(email, dto.tenantCode);

    // Generic invalid credentials — avoid enumeration
    if (!user) {
      await this.recordLoginHistory({
        email,
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ...meta,
      });
      await this.audit.log({
        action: 'auth.login.failure',
        module: 'identity',
        result: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason: 'INVALID_CREDENTIALS' },
      });
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'The credentials you entered are incorrect.',
      });
    }

    // Tenant status
    if (
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: false,
        reason: 'TENANT_SUSPENDED',
        ...meta,
      });
      throw new ForbiddenException({
        code: 'AUTH_TENANT_SUSPENDED',
        message: "This institution's access is currently suspended.",
      });
    }

    // Account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: false,
        reason: 'ACCOUNT_LOCKED',
        ...meta,
      });
      throw new HttpException(
        {
          code: 'AUTH_ACCOUNT_LOCKED',
          message: `Your account is temporarily locked. Try again later.`,
        },
        423,
      );
    }

    // Account status
    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: false,
        reason: 'ACCOUNT_INACTIVE',
        ...meta,
      });
      throw new ForbiddenException({
        code: 'AUTH_ACCOUNT_INACTIVE',
        message: 'This account is not active. Contact your administrator.',
      });
    }

    if (user.status === 'LOCKED') {
      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: false,
        reason: 'ACCOUNT_LOCKED',
        ...meta,
      });
      throw new HttpException(
        {
          code: 'AUTH_ACCOUNT_LOCKED',
          message: 'Your account is temporarily locked. Try again later.',
        },
        423,
      );
    }

    // Password
    if (!user.passwordHash) {
      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: false,
        reason: 'INVALID_CREDENTIALS',
        ...meta,
      });
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'The credentials you entered are incorrect.',
      });
    }

    const passwordOk = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      await this.handleFailedPassword(user.id, user.tenantId, email, meta);
      await this.audit.log({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'auth.login.password_failure',
        module: 'identity',
        result: 'FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'The credentials you entered are incorrect.',
      });
    }

    // MFA gate — permanent TOTP factor required when enabled
    if (user.mfaEnabled) {
      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: true,
        reason: 'MFA_REQUIRED',
        ...meta,
      });
      await this.audit.log({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'auth.login.mfa_required',
        module: 'identity',
        result: 'SUCCESS',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return this.mfaService.createLoginChallenge({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        personaType: user.personaType,
      });
    }

    // Success path
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.recordLoginHistory({
      userId: user.id,
      tenantId: user.tenantId,
      email,
      success: true,
      reason: 'LOGIN_SUCCESS',
      ...meta,
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.login.success',
      module: 'identity',
      result: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.issueTokenPair(user.id, user.tenantId, user.email, user.personaType, meta);
  }

  // -------------------------------------------------------------------------
  // REFRESH
  // -------------------------------------------------------------------------

  async refresh(rawRefreshToken: string, meta: RequestMeta = {}): Promise<AuthTokensDto> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            personaType: true,
            status: true,
            deletedAt: true,
            tenant: { select: { status: true, deletedAt: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_INVALID',
        message: 'Invalid or expired refresh token.',
      });
    }

    // Reuse detection: already revoked
    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      await this.audit.log({
        tenantId: existing.user?.tenantId,
        actorUserId: existing.userId,
        action: 'auth.refresh.reuse_detected',
        module: 'identity',
        result: 'DENIED',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_INVALID',
        message: 'Invalid or expired refresh token.',
      });
    }

    if (existing.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_INVALID',
        message: 'Invalid or expired refresh token.',
      });
    }

    const user = existing.user;
    if (
      !user ||
      user.deletedAt ||
      user.status !== 'ACTIVE' ||
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_INVALID',
        message: 'Invalid or expired refresh token.',
      });
    }

    // Rotate atomically
    const tokens = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });

      const pair = this.tokenService.generateRefreshToken(existing.familyId);
      const access = this.tokenService.createAccessToken({
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        personaType: user.personaType,
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenHash: pair.tokenHash,
          familyId: pair.familyId,
          expiresAt: pair.expiresAt,
          deviceInfo: meta.deviceInfo ?? existing.deviceInfo,
          ipAddress: meta.ipAddress ?? existing.ipAddress,
        },
      });

      return {
        accessToken: access.accessToken,
        refreshToken: pair.rawToken,
        expiresIn: access.expiresIn,
        mfaRequired: false,
      };
    });

    return tokens;
  }

  // -------------------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------------------

  async logout(
    auth: AuthContext,
    rawRefreshToken?: string,
  ): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
      const record = await this.prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          userId: auth.userId,
          tenantId: auth.tenantId,
        },
      });
      if (record && !record.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        });
      }
      return;
    }

    // No refresh token provided: revoke all active sessions for this user in tenant
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: auth.userId,
        tenantId: auth.tenantId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'auth.logout',
      module: 'identity',
      result: 'SUCCESS',
    });
  }

  // -------------------------------------------------------------------------
  // ME
  // -------------------------------------------------------------------------

  async me(auth: AuthContext): Promise<MeResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: auth.userId,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        personaType: true,
        status: true,
        mfaEnabled: true,
        activatedAt: true,
        lastLoginAt: true,
        tenant: { select: { status: true, deletedAt: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: 'AUTH_ACCOUNT_INACTIVE',
        message: 'This account is not active.',
      });
    }

    if (
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      throw new ForbiddenException({
        code: 'AUTH_TENANT_SUSPENDED',
        message: "This institution's access is currently suspended.",
      });
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      personaType: user.personaType,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      activatedAt: user.activatedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async resolveUserForLogin(email: string, tenantCode?: string) {
    if (tenantCode) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { code: tenantCode, deletedAt: null },
      });
      if (!tenant) return null;

      return this.prisma.user.findFirst({
        where: {
          email,
          tenantId: tenant.id,
          deletedAt: null,
        },
        include: {
          tenant: { select: { status: true, deletedAt: true } },
        },
      });
    }

    // Without tenantCode: only succeed if exactly one active match
    const matches = await this.prisma.user.findMany({
      where: { email, deletedAt: null },
      include: {
        tenant: { select: { status: true, deletedAt: true } },
      },
      take: 2,
    });

    if (matches.length !== 1) return null;
    return matches[0];
  }

  private async handleFailedPassword(
    userId: string,
    tenantId: string,
    email: string,
    meta: RequestMeta,
  ): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });

    if (updated.failedLoginCount >= this.lockoutAttempts) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + this.lockoutMinutes);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'LOCKED',
          lockedUntil,
        },
      });
    }

    await this.recordLoginHistory({
      userId,
      tenantId,
      email,
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ...meta,
    });
  }

  private async issueTokenPair(
    userId: string,
    tenantId: string,
    email: string,
    personaType: string,
    meta: RequestMeta,
  ): Promise<AuthTokensDto> {
    const access = this.tokenService.createAccessToken({
      sub: userId,
      tenantId,
      email,
      personaType,
    });
    const refresh = this.tokenService.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tenantId,
        tokenHash: refresh.tokenHash,
        familyId: refresh.familyId,
        expiresAt: refresh.expiresAt,
        deviceInfo: meta.deviceInfo,
        ipAddress: meta.ipAddress,
      },
    });

    return {
      accessToken: access.accessToken,
      refreshToken: refresh.rawToken,
      expiresIn: access.expiresIn,
      mfaRequired: false,
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async recordLoginHistory(data: {
    userId?: string;
    tenantId?: string;
    email?: string;
    success: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
  }): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        email: data.email,
        success: data.success,
        reason: data.reason,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }
  // -------------------------------------------------------------------------
  // FORGOT PASSWORD
  // -------------------------------------------------------------------------

  /**
   * Always returns the same generic message to prevent account enumeration.
   * Never reveals whether the email exists, is active, or belongs to a tenant.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    meta: RequestMeta = {},
  ): Promise<{ message: string }> {
    const generic = {
      message:
        'If an account exists for this email, a password reset link has been sent.',
    };

    const email = dto.email.trim().toLowerCase();

    try {
      const user = await this.resolveUserForLogin(email, dto.tenantCode);

      // Enumeration protection: same response for missing / inactive / suspended
      if (
        !user ||
        user.deletedAt ||
        !user.passwordHash ||
        !user.tenant ||
        user.tenant.deletedAt ||
        ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
      ) {
        return generic;
      }

      // Only ACTIVE users receive a token (still same response)
      if (user.status !== 'ACTIVE' && user.status !== 'LOCKED') {
        return generic;
      }

      const { rawToken, tokenHash } = this.tokenService.generateOneTimeToken();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.resetTtlMinutes);

      // Future: edu.sp_auth_request_password_reset (PLANNED — consolidated DB phase)
      await this.passwordResetRepository.createResetToken({
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash,
        expiresAt,
      });

      // Never include raw token in production logs; NotificationService strips sensitive meta
      await this.notificationService.sendAuthNotification({
        type: 'password_reset',
        to: user.email,
        tenantId: user.tenantId,
        meta: {
          purpose: 'password_reset',
          expiresInMinutes: this.resetTtlMinutes,
        },
      });

      // Development-only: allow local testing without a real mailer
      if (this.config.get<string>('NODE_ENV') === 'development') {
        // Intentionally not using logger with the raw token in structured production logs.
        // Emit only when NODE_ENV=development for local manual testing.
        // eslint-disable-next-line no-console
        console.info(
          `[dev] password reset token for ${user.email} (tenant ${user.tenantId}): ${rawToken}`,
        );
      }

      await this.recordLoginHistory({
        userId: user.id,
        tenantId: user.tenantId,
        email,
        success: true,
        reason: 'PASSWORD_RESET_REQUESTED',
        ...meta,
      });
      await this.audit.log({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'auth.password_reset.request',
        module: 'identity',
        result: 'SUCCESS',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    } catch {
      // Swallow unexpected errors into generic response to avoid enumeration via timing/errors
    }

    return generic;
  }

  // -------------------------------------------------------------------------
  // RESET PASSWORD
  // -------------------------------------------------------------------------

  async resetPassword(
    dto: ResetPasswordDto,
    meta: RequestMeta = {},
  ): Promise<{ message: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Password and confirmation do not match.',
      });
    }

    this.passwordService.assertPolicy(dto.newPassword);

    const tokenHash = this.tokenService.hashOneTimeToken(dto.token);

    // Future: edu.sp_auth_consume_password_reset (PLANNED — consolidated DB phase)
    const record = await this.passwordResetRepository.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'AUTH_RESET_INVALID',
        message: 'This password reset link is invalid or has expired.',
      });
    }

    const user = record.user;
    if (
      !user ||
      user.deletedAt ||
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_RESET_INVALID',
        message: 'This password reset link is invalid or has expired.',
      });
    }

    // Enforce tenant binding: token.tenantId must match user.tenantId
    if (record.tenantId !== user.tenantId) {
      throw new UnauthorizedException({
        code: 'AUTH_RESET_INVALID',
        message: 'This password reset link is invalid or has expired.',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    // Future: edu.sp_auth_consume_password_reset (PLANNED — consolidated DB phase)
    await this.passwordResetRepository.consumeResetToken({
      resetTokenId: record.id,
      userId: user.id,
      tenantId: user.tenantId,
      passwordHash,
      unlockIfLocked: user.status === 'LOCKED',
    });

    await this.recordLoginHistory({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      success: true,
      reason: 'PASSWORD_RESET_COMPLETED',
      ...meta,
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.password_reset.success',
      module: 'identity',
      result: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Your password has been updated successfully.' };
  }

  // -------------------------------------------------------------------------
  // CREATE ACTIVATION TOKEN (internal / future invitation flow)
  // -------------------------------------------------------------------------

  /**
   * Issue a one-time activation token for a pending account.
   * Does not grant roles. Does not change personaType.
   * Future: edu.sp_auth_create_activation_token
   */
  async createActivationTokenForUser(
    userId: string,
    tenantId: string,
    meta: RequestMeta = {},
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        email: true,
        status: true,
        activatedAt: true,
        tenant: { select: { status: true, deletedAt: true } },
      },
    });

    if (!user || user.activatedAt || user.status === 'ACTIVE') {
      throw new BadRequestException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This account cannot be issued an activation token.',
      });
    }

    if (
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      throw new BadRequestException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This account cannot be issued an activation token.',
      });
    }

    const { rawToken, tokenHash } = this.tokenService.generateOneTimeToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.activationTtlHours);

    await this.activationRepository.createActivationToken({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt,
    });

    await this.notificationService.sendAuthNotification({
      type: 'account_activation',
      to: user.email,
      tenantId: user.tenantId,
      meta: {
        purpose: 'account_activation',
        expiresInHours: this.activationTtlHours,
      },
    });

    if (this.config.get<string>('NODE_ENV') === 'development') {
      // eslint-disable-next-line no-console
      console.info(
        `[dev] activation token for ${user.email} (tenant ${user.tenantId}): ${rawToken}`,
      );
    }

    await this.recordLoginHistory({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      success: true,
      reason: 'ACTIVATION_TOKEN_ISSUED',
      ...meta,
    });

    return { rawToken, expiresAt };
  }

  // -------------------------------------------------------------------------
  // ACTIVATE ACCOUNT
  // -------------------------------------------------------------------------

  /**
   * Activate a pending account using a one-time token and set initial password.
   * Client cannot supply userId, tenantId, role, or personaType.
   * Future: edu.sp_auth_activate_account
   */
  async activateAccount(
    dto: ActivateAccountDto,
    meta: RequestMeta = {},
  ): Promise<{ message: string }> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Password and confirmation do not match.',
      });
    }

    this.passwordService.assertPolicy(dto.password);

    const tokenHash = this.tokenService.hashOneTimeToken(dto.token);
    const record = await this.activationRepository.findByTokenHash(tokenHash);

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This activation link is invalid or has expired.',
      });
    }

    const user = record.user;
    if (
      !user ||
      user.deletedAt ||
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This activation link is invalid or has expired.',
      });
    }

    // Tenant binding
    if (record.tenantId !== user.tenantId) {
      throw new UnauthorizedException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This activation link is invalid or has expired.',
      });
    }

    // Already active — activation is not an alternate password-change path
    if (user.status === 'ACTIVE' || user.activatedAt) {
      throw new UnauthorizedException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This activation link is invalid or has expired.',
      });
    }

    // Only INACTIVE (pending) accounts may activate via this flow
    if (user.status !== 'INACTIVE') {
      throw new UnauthorizedException({
        code: 'AUTH_ACTIVATION_INVALID',
        message: 'This activation link is invalid or has expired.',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.activationRepository.activateAccount({
      activationTokenId: record.id,
      userId: user.id,
      tenantId: user.tenantId,
      passwordHash,
    });

    // Promote any PENDING user_roles created during self-registration
    await this.registrationRepository.activatePendingRoles(
      user.id,
      user.tenantId,
    );

    await this.recordLoginHistory({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      success: true,
      reason: 'ACCOUNT_ACTIVATED',
      ...meta,
    });

    await this.audit.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'auth.activation.success',
      module: 'identity',
      result: 'SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      message: 'Your account has been activated. You can now sign in.',
    };
  }

}
