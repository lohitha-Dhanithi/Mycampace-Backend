/** @deprecated Public Identity APIs are served by identity-service via gateway. Do not re-register these controllers on platform. */
import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SsoService } from '../services/sso.service';
import { Public } from '../decorators/public.decorator';
import type { SsoProviderType } from '../sso/sso-provider.interface';

@ApiTags('SSO')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List available SSO providers for a tenant context' })
  listProviders(@Query('tenantCode') tenantCode?: string) {
    return this.ssoService.listAvailableProviders(tenantCode);
  }

  @Public()
  @Post(':provider/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start SSO authorization' })
  start(
    @Param('provider') provider: SsoProviderType,
    @Query('tenantCode') tenantCode?: string,
  ) {
    return this.ssoService.start(provider, tenantCode);
  }

  @Public()
  @Get(':provider/callback')
  @ApiOperation({ summary: 'SSO OAuth/OIDC callback' })
  callback(
    @Param('provider') provider: SsoProviderType,
    @Query() query: { code?: string; state?: string; SAMLResponse?: string },
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    return this.ssoService.callback(provider, query, {
      ipAddress: ip,
      userAgent: req.headers['user-agent']
        ? String(req.headers['user-agent']).slice(0, 512)
        : undefined,
    });
  }
}
