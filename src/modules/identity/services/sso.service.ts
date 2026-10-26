import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../../../common/redis/redis.service';
import { GoogleOidcProvider } from '../sso/providers/google-oidc.provider';
import { MicrosoftOidcProvider } from '../sso/providers/microsoft-oidc.provider';
import { SamlProvider } from '../sso/providers/saml.provider';
import { SsoProviderType } from '../sso/sso-provider.interface';
import { ExternalIdentityRepository } from '../repositories/external-identity.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { RequestMeta } from './auth.service';

@Injectable()
export class SsoService {
  constructor(
    private readonly google: GoogleOidcProvider,
    private readonly microsoft: MicrosoftOidcProvider,
    private readonly saml: SamlProvider,
    private readonly externalIdentities: ExternalIdentityRepository,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly mfaService: MfaService,
    private readonly config: ConfigService,
  ) {}

  listAvailableProviders(tenantCode?: string) {
    // Tenant-specific DB config can refine this later; env-level for foundation
    void tenantCode;
    return [
      {
        provider: 'google' as const,
        displayName: 'Google',
        enabled: this.google.isConfigured(),
      },
      {
        provider: 'microsoft' as const,
        displayName: 'Microsoft',
        enabled: this.microsoft.isConfigured(),
      },
      {
        provider: 'saml' as const,
        displayName: 'Enterprise SSO',
        enabled: this.saml.isConfigured(),
      },
    ];
  }

  async start(
    provider: SsoProviderType,
    tenantCode?: string,
  ): Promise<{ authorizationUrl: string }> {
    const adapter = this.adapter(provider);
    if (!adapter.isConfigured()) {
      throw new BadRequestException({
        code: 'AUTH_SSO_NOT_CONFIGURED',
        message: `${provider} SSO is not configured. Live provider verification requires provider configuration.`,
      });
    }

    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const redirectUri = this.callbackUrl(provider);

    await this.redis.set(
      `auth:sso:state:${state}`,
      JSON.stringify({ provider, nonce, tenantCode, createdAt: Date.now() }),
      600,
    );

    const authorizationUrl = adapter.getAuthorizationUrl({
      state,
      nonce,
      redirectUri,
      tenantCode,
    });

    return { authorizationUrl };
  }

  async callback(
    provider: SsoProviderType,
    query: { code?: string; state?: string; SAMLResponse?: string },
    meta: RequestMeta = {},
  ) {
    if (!query.state) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }

    const raw = await this.redis.get(`auth:sso:state:${query.state}`);
    if (!raw) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }
    await this.redis.del(`auth:sso:state:${query.state}`);

    const stored = JSON.parse(raw) as {
      provider: string;
      nonce: string;
      tenantCode?: string;
    };
    if (stored.provider !== provider) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }

    const adapter = this.adapter(provider);
    const identity = await adapter.exchangeCallback({
      code: query.code,
      state: query.state,
      expectedState: query.state,
      expectedNonce: stored.nonce,
      redirectUri: this.callbackUrl(provider),
      samlResponse: query.SAMLResponse,
    });

    // Resolve tenant
    let tenantId: string | undefined;
    if (stored.tenantCode) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { code: stored.tenantCode, deletedAt: null, status: 'ACTIVE' },
      });
      if (!tenant) {
        throw new UnauthorizedException({
          code: 'AUTH_SSO_INVALID',
          message: 'Invalid SSO callback.',
        });
      }
      tenantId = tenant.id;
    }

    if (!tenantId) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message:
          'Tenant context is required for SSO. Provide tenantCode when starting SSO.',
      });
    }

    const linked = await this.externalIdentities.findByProviderSubject(
      tenantId,
      identity.provider,
      identity.providerSubject,
    );

    if (!linked || !linked.user || linked.user.deletedAt) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_NO_LINKED_ACCOUNT',
        message:
          'No linked EduCore account for this identity. Contact your administrator.',
      });
    }

    const user = linked.user;
    if (user.status !== 'ACTIVE') {
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
      throw new UnauthorizedException({
        code: 'AUTH_TENANT_SUSPENDED',
        message: "This institution's access is currently suspended.",
      });
    }

    await this.externalIdentities.touchLogin(linked.id);

    // MFA policy: if user has MFA enabled, challenge before session
    if (user.mfaEnabled) {
      return this.mfaService.createLoginChallenge({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        personaType: user.personaType,
      });
    }

    const access = this.tokenService.createAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      personaType: user.personaType,
    });
    const refresh = this.tokenService.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: refresh.tokenHash,
        familyId: refresh.familyId,
        expiresAt: refresh.expiresAt,
        deviceInfo: meta.deviceInfo,
        ipAddress: meta.ipAddress,
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: access.accessToken,
      refreshToken: refresh.rawToken,
      expiresIn: access.expiresIn,
      mfaRequired: false as const,
    };
  }

  private adapter(provider: SsoProviderType) {
    switch (provider) {
      case 'google':
        return this.google;
      case 'microsoft':
        return this.microsoft;
      case 'saml':
        return this.saml;
      default:
        throw new BadRequestException({
          code: 'AUTH_SSO_INVALID',
          message: 'Unknown SSO provider.',
        });
    }
  }

  private callbackUrl(provider: SsoProviderType): string {
    const base =
      this.config.get<string>('API_URL') ||
      `http://localhost:${this.config.get('PORT', 4000)}`;
    const prefix = this.config.get<string>('API_PREFIX', 'api/v1');
    const configured = this.config.get<string>(
      `${provider.toUpperCase()}_CALLBACK_URL`,
    );
    return (
      configured || `${base}/${prefix}/auth/sso/${provider}/callback`
    );
  }
}
