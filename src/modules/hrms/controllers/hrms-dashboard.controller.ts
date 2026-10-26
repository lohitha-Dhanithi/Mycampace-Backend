import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrmsDashboardService } from '../services/hrms-dashboard.service';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('HRMS Dashboard')
@ApiBearerAuth()
@Controller('hrms/dashboard')
export class HrmsDashboardController {
  constructor(private readonly dashboard: HrmsDashboardService) {}

  @Get()
  @RequirePermission('hrms.dashboard.read')
  @ApiOperation({ summary: 'Headcount, leave queue, appraisal progress, attendance and compliance alerts' })
  get(@CurrentUser() user: AuthContext, @Query('campusId') campusId?: string) {
    return this.dashboard.get(user, campusId);
  }
}
