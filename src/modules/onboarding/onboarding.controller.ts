import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, AuthenticatedUser } from '@/common/auth/current-user.decorator'
import { AllowUnverified } from '@/common/auth/allow-unverified.decorator'
import { OnboardingService } from './onboarding.service'
import {
  InstitutionsSetupDto,
  OrganizationSetupDto,
  ProductSelectionDto,
  TeamInviteDto,
} from './onboarding.dto'

@ApiTags('Onboarding')
@ApiBearerAuth()
@AllowUnverified()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get onboarding progress for the current organization' })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getStatus(user.organizationId)
  }

  @Post('organization')
  @ApiOperation({ summary: 'Step 1 — organization profile' })
  saveOrganization(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrganizationSetupDto) {
    return this.onboardingService.saveOrganization(user.organizationId, dto)
  }

  @Post('institutions')
  @ApiOperation({ summary: 'Step 2 — institutions and campuses' })
  saveInstitutions(@CurrentUser() user: AuthenticatedUser, @Body() dto: InstitutionsSetupDto) {
    return this.onboardingService.saveInstitutions(user.organizationId, dto)
  }

  @Post('products')
  @ApiOperation({ summary: 'Step 3 — product entitlements' })
  saveProducts(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProductSelectionDto) {
    return this.onboardingService.saveProducts(user.organizationId, dto)
  }

  @Post('team')
  @ApiOperation({ summary: 'Step 4 — team invitations' })
  saveTeam(@CurrentUser() user: AuthenticatedUser, @Body() dto: TeamInviteDto) {
    return this.onboardingService.saveTeamInvites(user.organizationId, dto)
  }

  @Post('complete')
  @ApiOperation({ summary: 'Step 5 — finalize onboarding workspace' })
  complete(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.complete(user.organizationId)
  }
}
