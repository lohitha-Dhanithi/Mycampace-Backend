import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppraisalStage } from '../../../generated/prisma-client';
import { AppraisalService } from '../services/appraisal.service';
import { AdvanceAppraisalDto, CreateAppraisalCycleDto, ScoreMetricDto } from '../dto/attendance-appraisal.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('HRMS Appraisals')
@ApiBearerAuth()
@Controller('hrms/appraisals')
export class AppraisalController {
  constructor(private readonly appraisals: AppraisalService) {}

  @Get('cycles')
  @RequirePermission('hrms.appraisal.read')
  cycles(@CurrentUser() user: AuthContext) {
    return this.appraisals.listCycles(user);
  }

  @Post('cycles')
  @RequirePermission('hrms.appraisal.manage')
  @ApiOperation({ summary: 'Create a cycle and open a review for every active staff member' })
  createCycle(@CurrentUser() user: AuthContext, @Body() dto: CreateAppraisalCycleDto) {
    return this.appraisals.createCycle(user, dto);
  }

  @Post('cycles/:id/close')
  @RequirePermission('hrms.appraisal.manage')
  closeCycle(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.appraisals.closeCycle(user, id);
  }

  @Get()
  @RequirePermission('hrms.appraisal.read')
  list(
    @CurrentUser() user: AuthContext,
    @Query('cycleId') cycleId?: string,
    @Query('stage', new ParseEnumPipe(AppraisalStage, { optional: true })) stage?: AppraisalStage,
  ) {
    return this.appraisals.list(user, { cycleId, stage });
  }

  @Get('assigned')
  @RequirePermission('hrms.self')
  @ApiOperation({ summary: 'HOD-stage reviews waiting on me as department head or reporting manager' })
  assigned(@CurrentUser() user: AuthContext) {
    return this.appraisals.assignedToMe(user);
  }

  @Get(':id')
  @RequirePermission('hrms.appraisal.read', 'hrms.self')
  get(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.appraisals.get(user, id);
  }

  @Patch(':id/metrics/:metricId')
  @RequirePermission('hrms.self', 'hrms.appraisal.manage', 'hrms.appraisal.principal')
  @ApiOperation({ summary: 'Score one metric (1-5) for the current stage' })
  score(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('metricId', ParseUUIDPipe) metricId: string,
    @Body() dto: ScoreMetricDto,
  ) {
    return this.appraisals.scoreMetric(user, id, metricId, dto);
  }

  @Post(':id/advance')
  @RequirePermission('hrms.self', 'hrms.appraisal.manage', 'hrms.appraisal.principal')
  @ApiOperation({ summary: 'Submit the current stage and move the review forward' })
  advance(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceAppraisalDto,
  ) {
    return this.appraisals.advance(user, id, dto);
  }
}
