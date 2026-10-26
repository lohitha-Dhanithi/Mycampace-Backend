import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BrandingService } from '../services/branding.service';
import {
  ApplyTemplateDto,
  UpdateBrandingDto,
  PublishBrandingDto,
} from '../dto/branding.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { Public } from '../../identity/decorators/public.decorator';

@ApiTags('Branding')
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Public()
  @Get('theme-templates')
  @ApiOperation({ summary: 'System theme template catalog' })
  listTemplates() {
    return this.branding.listTemplates();
  }

  @Public()
  @Get('runtime')
  @ApiOperation({ summary: 'Published branding for runtime theme engine' })
  runtime(@Query('institutionId') institutionId: string) {
    return this.branding.getPublishedByInstitution(institutionId);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermission('branding.manage', 'institution.read')
  @ApiOperation({ summary: 'Get draft or published branding for institution' })
  get(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId: string,
    @Query('status') status?: 'DRAFT' | 'PUBLISHED',
  ) {
    return this.branding.getBranding(
      user,
      institutionId,
      status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    );
  }

  @Post('apply-template')
  @ApiBearerAuth()
  @RequirePermission('branding.manage')
  applyTemplate(
    @CurrentUser() user: AuthContext,
    @Body() dto: ApplyTemplateDto,
  ) {
    return this.branding.applyTemplate(user, dto);
  }

  @Patch()
  @ApiBearerAuth()
  @RequirePermission('branding.manage')
  update(@CurrentUser() user: AuthContext, @Body() dto: UpdateBrandingDto) {
    return this.branding.updateDraft(user, dto);
  }

  @Post('publish')
  @ApiBearerAuth()
  @RequirePermission('branding.manage')
  publish(@CurrentUser() user: AuthContext, @Body() dto: PublishBrandingDto) {
    return this.branding.publish(user, dto);
  }

  @Get('versions')
  @ApiBearerAuth()
  @RequirePermission('branding.manage')
  versions(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId: string,
  ) {
    return this.branding.versions(user, institutionId);
  }

  @Post('assets')
  @ApiBearerAuth()
  @RequirePermission('branding.manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        institutionId: { type: 'string' },
        assetType: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async upload(
    @CurrentUser() user: AuthContext,
    @Body('institutionId') institutionId: string,
    @Body('assetType') assetType: string,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file) {
      return { code: 'BRANDING_ASSET_MISSING', message: 'File required' };
    }
    return this.branding.registerAssetMetadata(user, {
      institutionId,
      assetType: assetType || 'LOGO',
      contentType: file.mimetype,
      body: file.buffer,
      originalName: file.originalname,
    });
  }
}
