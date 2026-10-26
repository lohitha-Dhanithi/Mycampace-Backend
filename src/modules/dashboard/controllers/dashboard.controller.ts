import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from '../services/dashboard.service';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('executive')
  @RequirePermission('dashboard.executive.read')
  @ApiOperation({
    summary: 'Executive / group dashboard summary from real aggregates',
    description:
      'Uses Institution + AdmissionApplication + User counts only. No fabricated metrics.',
  })
  executive(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.dashboard.getExecutiveSummary(user, institutionId);
  }
}
