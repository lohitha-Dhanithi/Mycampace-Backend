import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { VerificationStatus } from '@prisma/client'
import { CurrentUser, AuthenticatedUser } from '@/common/auth/current-user.decorator'
import { AllowUnverified } from '@/common/auth/allow-unverified.decorator'
import { RequirePlatformRole } from '@/common/auth/rbac.decorators'
import { MAX_UPLOAD_BYTES } from './document-policy'
import { VerificationService } from './verification.service'
import {
  ApplicationListQueryDto,
  ApproveDto,
  RejectDto,
  ReviewDocumentDto,
  UploadDocumentDto,
} from './verification.dto'

function sendFile(res: Response, f: { body: Buffer; mimeType: string; filename: string }) {
  res.set({
    'Content-Type': f.mimeType,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  })
  return new StreamableFile(f.body)
}

/** Organization administrator: upload documents, review everything, submit for verification. */
@ApiTags('Verification')
@ApiBearerAuth()
@ApiCookieAuth('mc_at')
@AllowUnverified()
@RequirePlatformRole('OrganizationAdmin')
@Controller('verification')
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get('status')
  @ApiOperation({ summary: 'Verification status of my organization (Draft / Submitted / Approved / Rejected)' })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStatus(user.organizationId)
  }

  @Get('requirements')
  @ApiOperation({ summary: 'Backend-computed document checklist: required vs optional, formats, size limits, uploaded files' })
  requirements(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getRequirements(user.organizationId)
  }

  @Get('review')
  @ApiOperation({ summary: 'All data entered across the onboarding steps plus documents, for the final review screen' })
  review(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getReviewPack(user.organizationId)
  }

  @Post('documents')
  @ApiOperation({ summary: 'Upload (or replace) one document. Type, size and file signature are validated on the server.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'docType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string', example: 'pan_card' },
        campusId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Stored' })
  @ApiResponse({ status: 413, description: 'File larger than the limit for this document' })
  @ApiResponse({ status: 415, description: 'File type not allowed or signature mismatch' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.service.uploadDocument(user, file, dto.docType, dto.campusId)
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: 'Remove an uploaded document (only before submission or after rejection)' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteDocument(user, id)
  }

  @Get('documents/:id/download')
  @ApiOperation({ summary: 'Preview / download one of my documents (authenticated, never public)' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendFile(res, await this.service.readDocument(user, id))
  }

  @Post('submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send the application for superadmin verification (fails if required documents are missing)' })
  @ApiResponse({ status: 422, description: 'Required documents missing or onboarding incomplete' })
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.service.submit(user)
  }

  @Post('demo/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'TEST MODE ONLY: approve my own submitted application (404 unless test mode is on; never in production)' })
  demoApprove(@CurrentUser() user: AuthenticatedUser) {
    return this.service.demoDecide(user, 'approve')
  }

  @Post('demo/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'TEST MODE ONLY: decline my own submitted application and send the "verification failed" email' })
  demoDecline(@CurrentUser() user: AuthenticatedUser) {
    return this.service.demoDecide(user, 'decline')
  }
}

/** SuperAdmin only: verification queue, document review, approve / decline. */
@ApiTags('Superadmin Verification')
@ApiBearerAuth()
@ApiCookieAuth('mc_at')
@RequirePlatformRole('SuperAdmin')
@Controller('superadmin/verifications')
export class SuperadminVerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get()
  @ApiOperation({ summary: 'Verification queue with status filter, search and pagination' })
  list(@Query() q: ApplicationListQueryDto) {
    return this.service.listApplications({
      status: q.status as VerificationStatus | undefined,
      search: q.search,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
    })
  }

  @Get(':organizationId')
  @ApiOperation({ summary: 'Full application: profile, institutions, campuses, checklist and documents' })
  get(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.service.getApplication(organizationId)
  }

  @Get(':organizationId/documents/:id/download')
  @ApiOperation({ summary: 'Preview a submitted document (access is audit-logged)' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', ParseUUIDPipe) _organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendFile(res, await this.service.readDocument(user, id))
  }

  @Post(':organizationId/documents/:id/review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or reject a single document (reason required when rejecting)' })
  reviewDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.service.reviewDocument(user, organizationId, id, dto.decision, dto.note)
  }

  @Post(':organizationId/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve: only possible when every required document is present and accepted' })
  @ApiResponse({ status: 409, description: 'Already decided or resubmitted since opened' })
  @ApiResponse({ status: 422, description: 'Required documents missing or not accepted' })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: ApproveDto,
  ) {
    return this.service.approve(user, organizationId, dto.round, dto.note)
  }

  @Post(':organizationId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Decline with a mandatory reason that the applicant will see' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: RejectDto,
  ) {
    return this.service.reject(user, organizationId, dto.reason, dto.round)
  }
}
