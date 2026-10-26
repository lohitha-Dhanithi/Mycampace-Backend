import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SsoProviderAdapter,
  SsoAuthUrlParams,
  SsoVerifiedIdentity,
} from '../sso-provider.interface';
import { createHash, randomBytes } from 'crypto';

/**
 * Google OIDC adapter.
 * Live verification requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 */
@Injectable()
export class GoogleOidcProvider implements SsoProviderAdapter {
  readonly type = 'google' as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get('GOOGLE_CLIENT_ID') &&
      this.config.get('GOOGLE_CLIENT_SECRET')
    );
  }

  getAuthorizationUrl(params: SsoAuthUrlParams): string {
    if (!this.isConfigured()) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_NOT_CONFIGURED',
        message: 'Google SSO is not configured.',
      });
    }
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')!;
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: params.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: params.state,
      nonce: params.nonce,
      access_type: 'online',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
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

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')!;
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')!;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: params.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
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

    // Validate ID token via tokeninfo (production should use JWKS)
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`,
    );
    if (!infoRes.ok) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_INVALID',
        message: 'Invalid SSO callback.',
      });
    }
    const claims = (await infoRes.json()) as {
      sub: string;
      email?: string;
      email_verified?: string;
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
    if (
      claims.iss !== 'https://accounts.google.com' &&
      claims.iss !== 'accounts.google.com'
    ) {
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
      provider: 'google',
      providerSubject: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === 'true',
    };
  }
}
