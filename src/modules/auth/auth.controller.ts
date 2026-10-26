import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import {
  EmailSignInDto,
  SignUpDto,
  GoogleAuthDto,
  RefreshTokenDto,
  LogoutDto,
  TabLifecycleDto,
} from './auth.dto'
import { Public } from '@/common/auth/public.decorator'
import { AllowUnverified } from '@/common/auth/allow-unverified.decorator'
import { CurrentUser, AuthenticatedUser } from '@/common/auth/current-user.decorator'
import {
  clearAuthCookies,
  refreshTokenFromCookie,
  setAuthCookies,
  type IssuedSession,
} from './auth.cookies'

@ApiTags('Identity & Auth')
@AllowUnverified()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Tokens go into HttpOnly cookies only; the JSON body carries the profile, never a token. */
  private respond<T extends IssuedSession>(res: Response, session: T) {
    const { accessToken, refreshToken, sessionId: _sessionId, ...body } = session as T & { sessionId?: string }
    setAuthCookies(
      res,
      { accessToken, refreshToken, expiresIn: session.expiresIn },
      parseInt(this.config.get<string>('JWT_REFRESH_EXPIRATION_DAYS', '30'), 10),
    )
    return body
  }

  @Public()
  @Post('signin/email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with registered email and password (sets HttpOnly session cookies)' })
  @ApiResponse({ status: 200, description: 'Authenticated. Tokens are set as HttpOnly cookies.' })
  async signInWithEmail(@Body() dto: EmailSignInDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.authService.signInWithEmail(dto))
  }

  @Public()
  @Post('signin/google')
  @HttpCode(200)
  @ApiOperation({ summary: 'OAuth Google SSO authentication (dev: email optional)' })
  @ApiResponse({ status: 200, description: 'Google identity verified and session cookies set' })
  async signInWithGoogle(@Body() dto: GoogleAuthDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.authService.signInWithGoogle(dto))
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Register a new institutional owner account' })
  @ApiResponse({ status: 201, description: 'User account created; onboarding required' })
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.authService.signUpWithEmail(dto))
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth('mc_rt')
  @ApiOperation({ summary: 'Rotate the session using the refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = refreshTokenFromCookie(req) ?? dto?.refreshToken
    try {
      return this.respond(res, await this.authService.refreshSession(token))
    } catch (e) {
      clearAuthCookies(res)
      throw e
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the refresh token and clear session cookies' })
  async logout(
    @Req() req: Request,
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(refreshTokenFromCookie(req) ?? dto?.refreshToken)
    clearAuthCookies(res)
    return result
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiCookieAuth('mc_at')
  @ApiOperation({ summary: 'Get current user profile and product permissions' })
  @ApiResponse({ status: 200, description: 'Current authenticated session identity' })
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId)
  }

  /**
   * Identified by the refresh cookie (sent to /api/auth/*), so it works with an expired access token
   * and from navigator.sendBeacon while the tab is closing. Parameters are in the query string so the
   * beacon is a simple request with no body or preflight.
   */
  @Public()
  @Post('tab-lifecycle')
  @HttpCode(204)
  @ApiCookieAuth('mc_rt')
  @ApiOperation({ summary: 'Report browser tab open/hidden; ends this browser session when its last tab closes' })
  async tabLifecycle(@Req() req: Request, @Query() dto: TabLifecycleDto) {
    await this.authService.recordTabLifecycle(refreshTokenFromCookie(req), dto.tabId.trim(), dto.phase)
  }
}
