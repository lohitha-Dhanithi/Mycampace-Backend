import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveRequestStatus } from '../../../generated/prisma-client';
import { LeaveService } from '../services/leave.service';
import { CreateLeaveForStaffDto, DecideLeaveDto } from '../dto/leave.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('HRMS Leave')
@ApiBearerAuth()
@Controller('hrms/leaves')
export class LeaveController {
  constructor(private readonly leaves: LeaveService) {}

  @Get()
  @RequirePermission('hrms.leave.read')
  @ApiOperation({ summary: 'Leave desk: all requests with filters' })
  list(
    @CurrentUser() user: AuthContext,
    @Query('status', new ParseEnumPipe(LeaveRequestStatus, { optional: true })) status?: LeaveRequestStatus,
    @Query('staffId') staffId?: string,
    @Query('campusId') campusId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.leaves.list(user, { status, staffId, campusId, page, pageSize });
  }

  @Post()
  @RequirePermission('hrms.leave.manage')
  @ApiOperation({ summary: 'HR creates a leave request on behalf of a staff member' })
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateLeaveForStaffDto) {
    return this.leaves.createForStaff(user, dto);
  }

  @Get('inbox')
  @RequirePermission('hrms.self')
  @ApiOperation({ summary: 'Requests currently assigned to me as reporting manager' })
  inbox(@CurrentUser() user: AuthContext) {
    return this.leaves.inbox(user);
  }

  @Get('preview-approver/:staffId')
  @RequirePermission('hrms.leave.manage', 'hrms.self')
  previewApprover(@CurrentUser() user: AuthContext, @Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.leaves.previewFirstApprover(user, staffId);
  }

  @Get(':id')
  @RequirePermission('hrms.leave.read', 'hrms.self')
  get(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leaves.get(user, id);
  }

  @Post(':id/manager-decision')
  @RequirePermission('hrms.self')
  @ApiOperation({ summary: 'Reporting manager approves or rejects a request assigned to them' })
  managerDecision(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leaves.decideAsManager(user, id, dto);
  }

  @Post(':id/hr-decision')
  @RequirePermission('hrms.leave.manage')
  @ApiOperation({ summary: 'Final HR decision (only after the reporting chain has approved)' })
  hrDecision(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leaves.decideAsHr(user, id, dto);
  }
}
