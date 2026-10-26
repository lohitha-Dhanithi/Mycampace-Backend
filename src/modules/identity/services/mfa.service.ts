import { AuditService } from '../../audit/services/audit.service';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { MfaRepository } from '../repositories/mfa.repository';
import { MfaCryptoService } from './mfa-crypto.service';
import { RedisService } from '../../../common/redis/redis.service';
import type { AuthContext } from '../interfaces/auth-context.interface';
import { TokenService } from './token.service';
import { RequestMeta } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Permanent MFA (TOTP) + Redis challenge state.
 * Future SPs: edu.sp_auth_mfa_factor_*
 */
@Injectable()
export class MfaService {
  private readonly challengeTtlSec: number;
  private readonly maxAttempts: number;
  private readonly issuer: string;

  constructor(
    private readonly mfaRepo: MfaRepository,
    private readonly crypto: MfaCryptoService,
    private readonly redis: RedisService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    const ttlMin = this.config.get<number>('MFA_CHALLENGE_TTL_MINUTES', 5);
    this.challengeTtlSec = ttlMin * 60;
    this.maxAttempts = this.config.get<number>('MFA_MAX_ATTEMPTS', 5);
    this.issuer = this.config.get<string>('APP_NAME', 'EduCore');
  }

  // ---------- Enrollment ----------

  async enrollTotp(auth: AuthContext) {
    const secret = this.generateBase32Secret(20);
    const encrypted = this.crypto.encrypt(secret);
    const factor = await this.mfaRepo.createPendingTotp({
      userId: auth.userId,
      tenantId: auth.tenantId,
      displayName: 'Authenticator app',
      encryptedSecret: encrypted,
    });

    const otpauth = `otpauth://totp/${encodeURIComponent(this.issuer)}:${encodeURIComponent(auth.email)}?secret=${secret}&issuer=${encodeURIComponent(this.issuer)}&algorithm=SHA1&digits=6&period=30`;

    return {
      factorId: factor.id,
      type: 'TOTP' as const,
      displayName: factor.displayName,
      /** Only returned during enrollment — never after verify */
      otpauthUri: otpauth,
      /** Manual entry fallback */
      secret,
    };
  }

  async verifyEnrollment(auth: AuthContext, factorId: string, code: string) {
    const factor = await this.mfaRepo.findByIdForUser(
      factorId,
      auth.userId,
      auth.tenantId,
    );
    if (!factor || factor.status !== 'PENDING' || !factor.encryptedSecret) {
      throw new BadRequestException({
        code: 'AUTH_MFA_FACTOR_INVALID',
        message: 'MFA enrollment is invalid or already completed.',
      });
    }

    const secret = this.crypto.decrypt(factor.encryptedSecret);
    if (!this.verifyTotp(secret, code)) {
      throw new UnauthorizedException({
        code: 'AUTH_MFA_CODE_INVALID',
        message: 'Invalid verification code.',
      });
    }

    await this.mfaRepo.activateFactor(factor.id);
    await this.mfaRepo.setUserMfaEnabled(auth.userId, true);

    await this.audit.log({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: 'mfa.enrollment.verified',
      module: 'identity',
      result: 'SUCCESS',
      entityType: 'MfaFactor',
      entityId: factorId,
    });

    return {
      factorId: factor.id,
      status: 'ACTIVE' as const,
      message: 'Authenticator MFA is now enabled.',
    };
  }

  async listFactors(auth: AuthContext) {
    return this.mfaRepo.listForUser(auth.userId, auth.tenantId);
  }

  async disableFactor(auth: AuthContext, factorId: string) {
    const factor = await this.mfaRepo.findByIdForUser(
      factorId,
      auth.userId,
      auth.tenantId,
    );
    if (!factor || factor.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'AUTH_MFA_FACTOR_INVALID',
        message: 'MFA factor cannot be disabled.',
      });
    }
    await this.mfaRepo.disableFactor(factor.id);
    const remaining = await this.mfaRepo.countActiveFactors(
      auth.userId,
      auth.tenantId,
    );
    if (remaining === 0) {
      await this.mfaRepo.setUserMfaEnabled(auth.userId, false);
    }
    return { message: 'MFA factor disabled.' };
  }

  // ---------- Login challenge ----------

  async createLoginChallenge(params: {
    userId: string;
    tenantId: string;
    email: string;
    personaType: string;
  }): Promise<{ mfaRequired: true; mfaChallengeToken: string }> {
    const factor = await this.mfaRepo.findActiveTotp(
      params.userId,
      params.tenantId,
    );
    if (!factor) {
      // mfaEnabled but no active factor — treat as no MFA for safety path
      // AuthService should only call this when mfaEnabled && active factor exists
      throw new ForbiddenException({
        code: 'AUTH_MFA_REQUIRED',
        message: 'MFA is required but no active factor is configured.',
      });
    }

    const challengeToken = randomBytes(32).toString('base64url');
    const key = `auth:mfa:challenge:${challengeToken}`;
    const payload = JSON.stringify({
      userId: params.userId,
      tenantId: params.tenantId,
      email: params.email,
      personaType: params.personaType,
      factorId: factor.id,
      attempts: 0,
      createdAt: Date.now(),
    });
    await this.redis.set(key, payload, this.challengeTtlSec);

    return { mfaRequired: true, mfaChallengeToken: challengeToken };
  }

  async verifyChallenge(
    challengeToken: string,
    code: string,
    meta: RequestMeta = {},
  ) {
    const key = `auth:mfa:challenge:${challengeToken}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new UnauthorizedException({
        code: 'AUTH_MFA_CHALLENGE_INVALID',
        message: 'MFA challenge is invalid or has expired.',
      });
    }

    const state = JSON.parse(raw) as {
      userId: string;
      tenantId: string;
      email: string;
      personaType: string;
      factorId: string;
      attempts: number;
    };

    if (state.attempts >= this.maxAttempts) {
      await this.redis.del(key);
      throw new UnauthorizedException({
        code: 'AUTH_MFA_CHALLENGE_INVALID',
        message: 'MFA challenge is invalid or has expired.',
      });
    }

    const factor = await this.mfaRepo.findByIdForUser(
      state.factorId,
      state.userId,
      state.tenantId,
    );
    if (!factor || factor.status !== 'ACTIVE' || !factor.encryptedSecret) {
      await this.redis.del(key);
      throw new UnauthorizedException({
        code: 'AUTH_MFA_CHALLENGE_INVALID',
        message: 'MFA challenge is invalid or has expired.',
      });
    }

    const secret = this.crypto.decrypt(factor.encryptedSecret);
    if (!this.verifyTotp(secret, code)) {
      state.attempts += 1;
      await this.redis.set(key, JSON.stringify(state), this.challengeTtlSec);
      throw new UnauthorizedException({
        code: 'AUTH_MFA_CODE_INVALID',
        message: 'Invalid verification code.',
      });
    }

    // Consume challenge atomically
    await this.redis.del(key);
    await this.mfaRepo.touchLastUsed(factor.id);

    // Re-validate user/tenant live
    const user = await this.prisma.user.findFirst({
      where: {
        id: state.userId,
        tenantId: state.tenantId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: { tenant: { select: { status: true, deletedAt: true } } },
    });
    if (
      !user ||
      !user.tenant ||
      user.tenant.deletedAt ||
      ['SUSPENDED', 'EXPIRED', 'ARCHIVED'].includes(user.tenant.status)
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_MFA_CHALLENGE_INVALID',
        message: 'MFA challenge is invalid or has expired.',
      });
    }

    await this.audit.log({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'mfa.challenge.verified',
      module: 'identity',
      result: 'SUCCESS',
    });

    // Issue tokens after successful MFA challenge
    return this.issueSessionAfterMfa(
      user.id,
      user.tenantId,
      user.email,
      user.personaType,
      meta,
    );
  }

  private async issueSessionAfterMfa(
    userId: string,
    tenantId: string,
    email: string,
    personaType: string,
    meta: RequestMeta,
  ) {
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });

    return {
      accessToken: access.accessToken,
      refreshToken: refresh.rawToken,
      expiresIn: access.expiresIn,
      mfaRequired: false as const,
    };
  }

  // ---------- TOTP primitives (RFC 6238) ----------

  private generateBase32Secret(bytes: number): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const buf = randomBytes(bytes);
    let bits = 0;
    let value = 0;
    let output = '';
    for (const b of buf) {
      value = (value << 8) | b;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
  }

  private base32ToBuffer(secret: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = secret.replace(/=+$/, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const c of cleaned) {
      const idx = alphabet.indexOf(c);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(out);
  }

  verifyTotp(secret: string, code: string, window = 1): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const key = this.base32ToBuffer(secret);
    const now = Math.floor(Date.now() / 1000);
    for (let w = -window; w <= window; w++) {
      const counter = Math.floor(now / 30) + w;
      const expected = this.hotp(key, counter);
      const a = Buffer.from(expected);
      const b = Buffer.from(code.padStart(6, '0'));
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    return false;
  }

  private hotp(key: Buffer, counter: number): string {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, '0');
  }
}
