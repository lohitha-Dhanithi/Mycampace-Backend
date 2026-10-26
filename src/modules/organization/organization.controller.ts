// backend/src/modules/organization/organization.controller.ts
import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { OrganizationService } from './organization.service'

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get global organization profile, branding, and domains' })
  @ApiResponse({ status: 200, description: 'Organization profile retrieved' })
  async getProfile() {
    return this.orgService.getOrganizationProfile()
  }

  @Get('institutions')
  @ApiOperation({ summary: 'Get list of institutions under this organization' })
  @ApiResponse({ status: 200, description: 'List of institutions' })
  async getInstitutions() {
    return this.orgService.getInstitutions()
  }

  @Get('campuses')
  @ApiOperation({ summary: 'Get list of campuses across all institutions' })
  @ApiResponse({ status: 200, description: 'List of campuses' })
  async getCampuses() {
    return this.orgService.getCampuses()
  }
}
