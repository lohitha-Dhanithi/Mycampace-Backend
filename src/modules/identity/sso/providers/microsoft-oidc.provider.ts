import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SsoProviderAdapter,
  SsoAuthUrlParams,
  SsoVerifiedIdentity,
} from '../sso-provider.interface';

/**
 * Microsoft Entra ID / Azure OIDC adapter.
 * Live verification requires MICROSOFT_CLIENT_ID / SECRET / TENANT_ID.
 */
@Injectable()
export class MicrosoftOidcProvider implements SsoProviderAdapter {
  readonly type = 'microsoft' as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get('MICROSOFT_CLIENT_ID') &&
      this.config.get('MICROSOFT_CLIENT_SECRET') &&
      this.config.get('MICROSOFT_TENANT_ID')
    );
  }

  private authority(): string {
    const tid = this.config.get<string>('MICROSOFT_TENANT_ID', 'common');
    return `https://login.microsoftonline.com/${tid}`;
  }

  getAuthorizationUrl(params: SsoAuthUrlParams): string {
    if (!this.isConfigured()) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_NOT_CONFIGURED',
        message: 'Microsoft SSO is not configured.',
      });
    }
    const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID')!;
    const q = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: params.redirectUri,
      response_mode: 'query',
      scope: 'openid email profile',
      state: params.state,
      nonce: params.nonce,
    });
    return `${this.authority()}/oauth2/v2.0/authorize?${q.toString()}`;
  }

  async exchangeCallback(params: {
    code?: string;
    state: string;
    expectedState: string;
    expectedNonce?: string;
    redirectUri: string;
  }): Promise<SsoVerifiedIdentity> {
    if (params.state !== params.expectedState) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO state.',
      });
    }
    if (!this.isConfigured() || !params.code) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }

    const clientId = this.config.get<string>('MICROSOFT_CLIENT_ID')!;
    const clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET')!;

    const tokenRes = await fetch(`${this.authority()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid email profile',
      }),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }

    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }

    // Decode JWT payload (signature validation via JWKS recommended for production)
    const payloadPart = tokens.id_token.split('.')[1];
    const claims = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    ) as {
      sub: string;
      email?: string;
      preferred_username?: string;
      aud?: string;
      iss?: string;
      nonce?: string;
    };

    if (claims.aud !== clientId) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }
    if (params.expectedNonce && claims.nonce !== params.expectedNonce) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }

    return {
      provider: 'microsoft',
      providerSubject: claims.sub,
      email: claims.email || claims.preferred_username,
      emailVerified: true,
    };
  }
}
