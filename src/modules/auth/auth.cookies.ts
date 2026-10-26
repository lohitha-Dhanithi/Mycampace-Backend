import type { Request, Response, NextFunction } from 'express'

export const ACCESS_COOKIE = 'mc_at'
export const REFRESH_COOKIE = 'mc_rt'
/** Header the SPA sends on every request. Cross-site forms cannot set it, and a cross-origin
 *  fetch that sets it triggers a CORS preflight that only CORS_ORIGIN origins pass. */
export const CSRF_HEADER = 'x-mycampace-csrf'

const REFRESH_PATH = '/api/auth'

type SameSite = 'lax' | 'strict' | 'none'

function baseOptions() {
  const production = process.env.NODE_ENV === 'production'
  const sameSite = (process.env.COOKIE_SAMESITE as SameSite | undefined) ?? 'lax'
  return {
    httpOnly: true,
    // SameSite=None is only accepted by browsers together with Secure.
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : production || sameSite === 'none',
    sameSite,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  }
}

export interface IssuedSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export function setAuthCookies(res: Response, s: IssuedSession, refreshTtlDays: number) {
  const base = baseOptions()
  res.cookie(ACCESS_COOKIE, s.accessToken, { ...base, path: '/', maxAge: s.expiresIn * 1000 })
  // Refresh token is only ever sent to the auth routes.
  res.cookie(REFRESH_COOKIE, s.refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: refreshTtlDays * 86400 * 1000,
  })
}

export function clearAuthCookies(res: Response) {
  const base = baseOptions()
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' })
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH })
}

export const accessTokenFromCookie = (req: Request): string | null => req?.cookies?.[ACCESS_COOKIE] ?? null
export const refreshTokenFromCookie = (req: Request): string | null => req?.cookies?.[REFRESH_COOKIE] ?? null

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
/** navigator.sendBeacon cannot set headers. Cross-site forgery is blocked by the SameSite refresh cookie,
 *  and the endpoint can at most keep alive or end the caller's own session. */
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/tab-lifecycle'])

/** Rejects cookie-authenticated state-changing requests that lack the CSRF header.
 *  Bearer-header requests (e.g. API tools) carry no ambient credentials and are exempt. */
export function csrfHeaderGuard(req: Request, res: Response, next: NextFunction) {
  const usesCookies = !!(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE])
  // Same-origin callers (Swagger UI on the API host) are exempt: browsers set Origin themselves.
  const origin = req.headers.origin
  if (origin && origin === `${req.protocol}://${req.headers.host}`) return next()
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next()
  if (MUTATING.has(req.method) && usesCookies && !req.headers.authorization && !req.headers[CSRF_HEADER]) {
    return res.status(403).json({ statusCode: 403, message: 'Missing CSRF header.' })
  }
  next()
}
