import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

const DEV_FALLBACK = 'mycampace_dev_jwt_secret'

/**
 * One place that decides which secret signs AND verifies access tokens, so the two can never disagree.
 * Accepts JWT_SECRET (this module) or JWT_ACCESS_SECRET (the name used in .env). In production a
 * missing secret is a startup error; the development fallback is never used there.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET') || config.get<string>('JWT_ACCESS_SECRET')
  if (secret) return secret
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET (or JWT_ACCESS_SECRET) must be set in production.')
  }
  new Logger('JwtSecret').warn('No JWT secret configured; using an insecure development default.')
  return DEV_FALLBACK
}
