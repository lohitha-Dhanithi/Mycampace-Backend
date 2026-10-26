export type SsoProviderType = 'google' | 'microsoft' | 'saml';

export interface SsoAuthUrlParams {
  tenantCode?: string;
  state: string;
  nonce: string;
  redirectUri: string;
}

export interface SsoVerifiedIdentity {
  provider: SsoProviderType;
  providerSubject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}

export interface SsoProviderAdapter {
  readonly type: SsoProviderType;
  isConfigured(): boolean;
  getAuthorizationUrl(params: SsoAuthUrlParams): string;
  /**
   * Validate callback and return trusted identity.
   * Must validate issuer, audience, signature/nonce/state as applicable.
   */
  exchangeCallback(params: {
    code?: string;
    state: string;
    expectedState: string;
    expectedNonce?: string;
    redirectUri: string;
    samlResponse?: string;
  }): Promise<SsoVerifiedIdentity>;
}
