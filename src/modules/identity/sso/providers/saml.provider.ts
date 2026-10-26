import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SsoProviderAdapter,
  SsoAuthUrlParams,
  SsoVerifiedIdentity,
} from '../sso-provider.interface';

/**
 * Enterprise SAML 2.0 adapter skeleton.
 * Full assertion crypto validation requires tenant-specific IdP metadata + certs.
 * Live verification requires SAML_* configuration and IdP setup.
 */
@Injectable()
export class SamlProvider implements SsoProviderAdapter {
  readonly type = 'saml' as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get('SAML_ENTRY_POINT') &&
      this.config.get('SAML_ISSUER') &&
      this.config.get('SAML_CERT')
    );
  }

  getAuthorizationUrl(params: SsoAuthUrlParams): string {
    if (!this.isConfigured()) {
      throw new UnauthorizedException({
        code: 'AUTH_SSO_NOT_CONFIGURED',
        message: 'Enterprise SAML SSO is not configured.',
      });
    }
    const entry = this.config.get<string>('SAML_ENTRY_POINT')!;
    const issuer = this.config.get<string>('SAML_ISSUER')!;
    // Minimal redirect binding — production should use a SAML library for AuthnRequest
    const q = new URLSearchParams({
      SAMLRequest: Buffer.from(
        `<AuthnRequest xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${params.state}" Version="2.0" IssueInstant="${new Date().toISOString()}" AssertionConsumerServiceURL="${params.redirectUri}"><Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</Issuer></AuthnRequest>`,
      ).toString('base64'),
      RelayState: params.state,
    });
    return `${entry}?${q.toString()}`;
  }

  async exchangeCallback(_params: {
    code?: string;
    state: string;
    expectedState: string;
    redirectUri: string;
    samlResponse?: string;
  }): Promise<SsoVerifiedIdentity> {
    // Full SAML response validation (signature, audience, conditions, replay)
    // requires a dedicated SAML library and tenant certs — not faked here.
    throw new UnauthorizedException({
      code: 'AUTH_SSO_NOT_CONFIGURED',
      message:
        'Live SAML verification requires IdP metadata and certificate configuration.',
    });
  }
}
