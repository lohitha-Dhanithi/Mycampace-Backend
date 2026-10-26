/**
 * Trusted identity context attached to authenticated requests.
 * Built from verified JWT + live DB checks — never from client input.
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  personaType: string;
}
