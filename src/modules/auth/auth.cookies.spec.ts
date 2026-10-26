import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_HEADER,
  clearAuthCookies,
  csrfHeaderGuard,
  refreshTokenFromCookie,
  setAuthCookies,
} from './auth.cookies'

const session = { accessToken: 'access-jwt', refreshToken: 'refresh-opaque', expiresIn: 900 }

function fakeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() } as any
}

function fakeReq(over: Record<string, any> = {}) {
  return { method: 'POST', cookies: {}, headers: {}, protocol: 'http', ...over } as any
}

describe('auth cookies', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })

  describe('setAuthCookies', () => {
    it('sets the access cookie HttpOnly on / with a lifetime equal to the token expiry', () => {
      const res = fakeRes()
      setAuthCookies(res, session, 30)
      const [name, value, opts] = res.cookie.mock.calls.find((c: any[]) => c[0] === ACCESS_COOKIE)
      expect(value).toBe('access-jwt')
      expect(opts).toMatchObject({ httpOnly: true, path: '/', maxAge: 900_000, sameSite: 'lax' })
      expect(name).toBe(ACCESS_COOKIE)
    })

    it('scopes the refresh cookie to /api/auth and the configured number of days', () => {
      const res = fakeRes()
      setAuthCookies(res, session, 30)
      const [, value, opts] = res.cookie.mock.calls.find((c: any[]) => c[0] === REFRESH_COOKIE)
      expect(value).toBe('refresh-opaque')
      expect(opts).toMatchObject({ httpOnly: true, path: '/api/auth', maxAge: 30 * 86400 * 1000 })
    })

    it('is Secure in production and honours COOKIE_SAMESITE / COOKIE_DOMAIN', () => {
      process.env.NODE_ENV = 'production'
      process.env.COOKIE_SAMESITE = 'strict'
      process.env.COOKIE_DOMAIN = '.mycampace.com'
      const res = fakeRes()
      setAuthCookies(res, session, 1)
      expect(res.cookie.mock.calls[0][2]).toMatchObject({
        secure: true,
        sameSite: 'strict',
        domain: '.mycampace.com',
      })
    })

    it('forces Secure when SameSite=None (browsers reject it otherwise)', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.COOKIE_SECURE
      process.env.COOKIE_SAMESITE = 'none'
      const res = fakeRes()
      setAuthCookies(res, session, 1)
      expect(res.cookie.mock.calls[0][2]).toMatchObject({ secure: true, sameSite: 'none' })
    })

    it('is not Secure in plain development', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.COOKIE_SECURE
      delete process.env.COOKIE_SAMESITE
      const res = fakeRes()
      setAuthCookies(res, session, 1)
      expect(res.cookie.mock.calls[0][2].secure).toBe(false)
    })
  })

  describe('clearAuthCookies', () => {
    it('clears both cookies using the same path they were set with', () => {
      const res = fakeRes()
      clearAuthCookies(res)
      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_COOKIE, expect.objectContaining({ path: '/' }))
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, expect.objectContaining({ path: '/api/auth' }))
    })
  })

  describe('refreshTokenFromCookie', () => {
    it('reads the refresh cookie and tolerates a missing cookie jar', () => {
      expect(refreshTokenFromCookie(fakeReq({ cookies: { [REFRESH_COOKIE]: 'abc' } }))).toBe('abc')
      expect(refreshTokenFromCookie(fakeReq({ cookies: {} }))).toBeNull()
      expect(refreshTokenFromCookie(fakeReq({ cookies: undefined }))).toBeNull()
    })
  })

  describe('csrfHeaderGuard', () => {
    const run = (req: any) => {
      const res = fakeRes()
      const next = jest.fn()
      csrfHeaderGuard(req, res, next)
      return { res, next }
    }

    it('rejects a cookie-authenticated write without the CSRF header (403)', () => {
      const { res, next } = run(fakeReq({ cookies: { [ACCESS_COOKIE]: 't' } }))
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('covers %s', (method) => {
      const { res } = run(fakeReq({ method, cookies: { [REFRESH_COOKIE]: 't' } }))
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('allows the write when the CSRF header is present', () => {
      const { next } = run(fakeReq({ cookies: { [ACCESS_COOKIE]: 't' }, headers: { [CSRF_HEADER]: '1' } }))
      expect(next).toHaveBeenCalled()
    })

    it('does not affect safe methods', () => {
      const { next } = run(fakeReq({ method: 'GET', cookies: { [ACCESS_COOKIE]: 't' } }))
      expect(next).toHaveBeenCalled()
    })

    it('does not affect requests with no session cookies (e.g. sign-in)', () => {
      const { next } = run(fakeReq())
      expect(next).toHaveBeenCalled()
    })

    it('exempts explicit Bearer requests (no ambient credentials)', () => {
      const { next } = run(fakeReq({ cookies: { [ACCESS_COOKIE]: 't' }, headers: { authorization: 'Bearer x' } }))
      expect(next).toHaveBeenCalled()
    })

    it('exempts same-origin calls such as Swagger UI', () => {
      const { next } = run(
        fakeReq({
          cookies: { [ACCESS_COOKIE]: 't' },
          headers: { origin: 'http://localhost:4000', host: 'localhost:4000' },
        }),
      )
      expect(next).toHaveBeenCalled()
    })

    it('still blocks a cross-site Origin', () => {
      const { res, next } = run(
        fakeReq({
          cookies: { [ACCESS_COOKIE]: 't' },
          headers: { origin: 'https://evil.example', host: 'localhost:4000' },
        }),
      )
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(403)
    })
  })
})
