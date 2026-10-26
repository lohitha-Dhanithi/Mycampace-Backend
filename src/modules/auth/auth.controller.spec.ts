import { UnauthorizedException } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.cookies'

const sessionFromService = {
  user: { id: 'u1', email: 'a@b.in' },
  accessToken: 'access-jwt',
  refreshToken: 'refresh-opaque',
  tokenType: 'Bearer',
  expiresIn: 900,
}

function build() {
  const auth: any = {
    signInWithEmail: jest.fn().mockResolvedValue({ ...sessionFromService }),
    signInWithGoogle: jest.fn().mockResolvedValue({ ...sessionFromService }),
    signUpWithEmail: jest.fn().mockResolvedValue({ ...sessionFromService, message: 'ok' }),
    refreshSession: jest.fn().mockResolvedValue({ ...sessionFromService }),
    logout: jest.fn().mockResolvedValue({ success: true }),
  }
  const config: any = { get: (_k: string, d?: unknown) => d }
  const controller = new AuthController(auth, config)
  const res: any = { cookie: jest.fn(), clearCookie: jest.fn() }
  return { controller, auth, res }
}

const cookieNames = (res: any) => res.cookie.mock.calls.map((c: any[]) => c[0])
const req = (cookies: Record<string, string> = {}) => ({ cookies }) as any

describe('AuthController cookie sessions', () => {
  it.each([
    ['signin/email', (c: AuthController, res: any) => c.signInWithEmail({ email: 'a@b.in', password: 'x' }, res)],
    ['signin/google', (c: AuthController, res: any) => c.signInWithGoogle({ idToken: 't' }, res)],
    ['signup', (c: AuthController, res: any) => c.signUp({ name: 'A', email: 'a@b.in', password: 'secret1' }, res)],
  ])('%s sets both cookies and never returns a token in the body', async (_n, call) => {
    const { controller, res } = build()
    const body: any = await call(controller, res)

    expect(cookieNames(res).sort()).toEqual([ACCESS_COOKIE, REFRESH_COOKIE].sort())
    expect(body).not.toHaveProperty('accessToken')
    expect(body).not.toHaveProperty('refreshToken')
    expect(JSON.stringify(body)).not.toContain('access-jwt')
    expect(JSON.stringify(body)).not.toContain('refresh-opaque')
    expect(body.user).toEqual(sessionFromService.user)
    expect(body.expiresIn).toBe(900)
  })

  it('refresh prefers the refresh cookie over a body value', async () => {
    const { controller, auth, res } = build()
    await controller.refresh(req({ [REFRESH_COOKIE]: 'from-cookie' }), { refreshToken: 'from-body' }, res)
    expect(auth.refreshSession).toHaveBeenCalledWith('from-cookie')
  })

  it('refresh falls back to the body for non-browser clients', async () => {
    const { controller, auth, res } = build()
    await controller.refresh(req(), { refreshToken: 'from-body' }, res)
    expect(auth.refreshSession).toHaveBeenCalledWith('from-body')
  })

  it('a failed refresh clears the cookies and rethrows 401', async () => {
    const { controller, auth, res } = build()
    auth.refreshSession.mockRejectedValue(new UnauthorizedException())
    await expect(controller.refresh(req({ [REFRESH_COOKIE]: 'bad' }), {}, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_COOKIE, expect.anything())
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, expect.anything())
    expect(res.cookie).not.toHaveBeenCalled()
  })

  it('logout revokes the cookie token and clears both cookies', async () => {
    const { controller, auth, res } = build()
    await expect(controller.logout(req({ [REFRESH_COOKIE]: 'rt' }), {}, res)).resolves.toEqual({ success: true })
    expect(auth.logout).toHaveBeenCalledWith('rt')
    expect(res.clearCookie).toHaveBeenCalledTimes(2)
  })

  it('logout still clears cookies when none were sent', async () => {
    const { controller, auth, res } = build()
    await controller.logout(req(), {}, res)
    expect(auth.logout).toHaveBeenCalledWith(undefined)
    expect(res.clearCookie).toHaveBeenCalledTimes(2)
  })
})
