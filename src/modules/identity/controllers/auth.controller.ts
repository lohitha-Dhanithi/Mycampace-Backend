/** @deprecated Public Identity APIs are served by identity-service via gateway. Do not re-register these controllers on platform. */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { RegistrationService } from '../services/registration.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { LogoutDto } from '../dto/logout.dto';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
} from '../dto/forgot-password.dto';
import {
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from '../dto/reset-password.dto';
import {
  ActivateAccountDto,
  ActivateAccountResponseDto,
} from '../dto/activate-account.dto';
import { AuthTokensDto, MeResponseDto } from '../dto/auth-response.dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthContext } from '../interfaces/auth-context.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registrationService: RegistrationService,
  ) {}


  @Public()
  @Get('registration-options')
  @ApiOperation({
    summary: 'Dynamic registration role catalog (no permissions exposed)',
  })
  registrationOptions() {
    return this.registrationService.getRegistrationOptions();
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register — self-service or pending-approval request',
    description:
      'Does not grant privileged roles. Uses tenantCode (not tenantId).',
  })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.registrationService.register(dto, this.metaFromReq(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Tokens or MFA challenge' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto | { mfaRequired: true; mfaChallengeToken: string }> {
    return this.authService.login(dto, this.metaFromReq(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access and refresh tokens' })
  @ApiResponse({ status: 200, type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken, this.metaFromReq(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current or all refresh sessions' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @CurrentUser() user: AuthContext,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    await this.authService.logout(user, dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  async me(@CurrentUser() user: AuthContext): Promise<MeResponseDto> {
    return this.authService.me(user);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Always returns a generic success message to prevent account enumeration.',
  })
  @ApiResponse({ status: 200, type: ForgotPasswordResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(dto, this.metaFromReq(req));
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a one-time token' })
  @ApiResponse({ status: 200, type: ResetPasswordResponseDto })
  @ApiResponse({ status: 400, description: 'Password policy violation' })
  @ApiResponse({ status: 401, description: 'Invalid or expired reset token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(dto, this.metaFromReq(req));
  }


  @Public()
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate account and set initial password',
    description:
      'Uses a one-time activation token. Does not accept role, persona, tenantId, or userId from the client.',
  })
  @ApiResponse({ status: 200, type: ActivateAccountResponseDto })
  @ApiResponse({ status: 400, description: 'Password policy violation' })
  @ApiResponse({ status: 401, description: 'Invalid or expired activation token' })
  async activate(
    @Body() dto: ActivateAccountDto,
    @Req() req: Request,
  ): Promise<ActivateAccountResponseDto> {
    return this.authService.activateAccount(dto, this.metaFromReq(req));
  }

  private metaFromReq(req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return {
      ipAddress: ip,
      userAgent: userAgent ? String(userAgent).slice(0, 512) : undefined,
      deviceInfo: userAgent ? String(userAgent).slice(0, 512) : undefined,
    };
  }
}
