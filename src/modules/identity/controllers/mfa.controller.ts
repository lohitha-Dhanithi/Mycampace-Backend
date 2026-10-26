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
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { MfaService } from '../services/mfa.service';
import { MfaEnrollVerifyDto, MfaVerifyDto, MfaDisableDto } from '../dto/mfa.dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthContext } from '../interfaces/auth-context.interface';

@ApiTags('MFA')
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('enroll')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start TOTP authenticator enrollment' })
  async enroll(@CurrentUser() user: AuthContext) {
    return this.mfaService.enrollTotp(user);
  }

  @Post('enroll/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify TOTP and activate MFA factor' })
  async enrollVerify(
    @CurrentUser() user: AuthContext,
    @Body() dto: MfaEnrollVerifyDto,
  ) {
    return this.mfaService.verifyEnrollment(user, dto.factorId, dto.code);
  }

  @Get('factors')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List MFA factors for current user' })
  async list(@CurrentUser() user: AuthContext) {
    return this.mfaService.listFactors(user);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable an active MFA factor' })
  async disable(
    @CurrentUser() user: AuthContext,
    @Body() dto: MfaDisableDto,
  ) {
    return this.mfaService.disableFactor(user, dto.factorId);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete MFA challenge after login' })
  async verify(@Body() dto: MfaVerifyDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    return this.mfaService.verifyChallenge(dto.challengeToken, dto.code, {
      ipAddress: ip,
      userAgent: req.headers['user-agent']
        ? String(req.headers['user-agent']).slice(0, 512)
        : undefined,
    });
  }
}
