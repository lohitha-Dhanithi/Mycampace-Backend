/**
 * Claims embedded in the short-lived access JWT.
 * Never include passwordHash or secrets.
 */
export interface JwtPayload {
  /** User id (subject) */
  sub: string;
  tenantId: string;
  email: string;
  personaType: string;
  iat?: number;
  exp?: number;
}
