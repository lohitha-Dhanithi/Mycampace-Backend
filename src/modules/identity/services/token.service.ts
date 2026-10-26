import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface AccessTokenResult {
  accessToken: string;
  expiresIn: string;
}

export interface RefreshTokenResult {
  /** Opaque raw token — return to client only; never log or store. */
  rawToken: string;
  /** SHA-256 hash for DB storage. */
  tokenHash: string;
  /** Family id for rotation / reuse detection. */
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresDays: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    // Parse JWT_REFRESH_EXPIRES_IN like "30d"
    const refreshRaw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const match = /^(\d+)d$/.exec(refreshRaw);
    this.refreshExpiresDays = match ? parseInt(match[1], 10) : 30;
  }

  createAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): AccessTokenResult {
    const accessToken = this.jwt.sign(
      {
        sub: payload.sub,
        tenantId: payload.tenantId,
        email: payload.email,
        personaType: payload.personaType,
      },
      { expiresIn: this.accessExpiresIn },
    );
    return { accessToken, expiresIn: this.accessExpiresIn };
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token);
  }

  /**
   * Generate a cryptographically secure opaque refresh token.
   * Returns raw token (client-facing) and hash (DB-facing).
   */
  generateRefreshToken(familyId?: string): RefreshTokenResult {
    const rawToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(rawToken);
    const resolvedFamilyId = familyId ?? randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiresDays);

    return {
      rawToken,
      tokenHash,
      familyId: resolvedFamilyId,
      expiresAt,
    };
  }

  hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Constant-time comparison of a raw token against a stored hash.
   */
  compareRefreshToken(rawToken: string, storedHash: string): boolean {
    const computed = this.hashRefreshToken(rawToken);
    try {
      const a = Buffer.from(computed, 'hex');
      const b = Buffer.from(storedHash, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Hash a one-time token (activation / password-reset) for DB storage.
   */
  hashOneTimeToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generate a cryptographically secure one-time token (activation / reset).
   */
  generateOneTimeToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hashOneTimeToken(rawToken) };
  }
}
