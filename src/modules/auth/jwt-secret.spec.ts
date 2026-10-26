import { resolveJwtSecret } from './jwt-secret'

const cfg = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as any

describe('resolveJwtSecret', () => {
  it('prefers JWT_SECRET', () => {
    expect(resolveJwtSecret(cfg({ JWT_SECRET: 'a', JWT_ACCESS_SECRET: 'b' }))).toBe('a')
  })

  it('accepts JWT_ACCESS_SECRET (the name used in .env), so sign and verify always agree', () => {
    expect(resolveJwtSecret(cfg({ JWT_ACCESS_SECRET: 'from-env' }))).toBe('from-env')
  })

  it('uses a development fallback outside production', () => {
    expect(resolveJwtSecret(cfg({ NODE_ENV: 'development' }))).toEqual(expect.any(String))
  })

  it('refuses to start in production without a secret', () => {
    expect(() => resolveJwtSecret(cfg({ NODE_ENV: 'production' }))).toThrow(/JWT_SECRET/)
  })
})
