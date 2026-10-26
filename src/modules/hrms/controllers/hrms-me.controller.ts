import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffService } from '../services/staff.service';
import { LeaveService } from '../services/leave.service';
import { AttendanceService } from '../services/attendance.service';
import { AppraisalService } from '../services/appraisal.service';
import { UpdateMyProfileDto } from '../dto/staff.dto';
import { CancelLeaveDto, CreateLeaveDto } from '../dto/leave.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { todayUtc } from '../common/hrms.util';

/**
 * My Portal. The staff record is always resolved from the authenticated user, never from a
 * client-supplied id, so a staff member can only read or change their own data.
 */
@ApiTags('HRMS My Portal')
@ApiBearerAuth()
@RequirePermission('hrms.self')
@Controller('hrms/me')
export class HrmsMeController {
  constructor(
    private readonly staff: StaffService,
    private readonly leaves: LeaveService,
    private readonly attendance: AttendanceService,
    private readonly appraisals: AppraisalService,
  ) {}

  @Get()
  me(@CurrentUser() user: AuthContext) {
    return this.staff.me(user);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own contact details (phone, qualification only)' })
  updateProfile(@CurrentUser() user: AuthContext, @Body() dto: UpdateMyProfileDto) {
    return this.staff.updateMe(user, dto);
  }

  @Get('leave-balances')
  async balances(@CurrentUser() user: AuthContext) {
    const me = await this.staff.me(user);
    return this.leaves.balancesFor(user, me.id);
  }

  @Get('leaves')
  myLeaves(@CurrentUser() user: AuthContext) {
    return this.leaves.listMine(user);
  }

  @Post('leaves')
  applyLeave(@CurrentUser() user: AuthContext, @Body() dto: CreateLeaveDto) {
    return this.leaves.createMine(user, dto);
  }

  @Post('leaves/:id/cancel')
  cancelLeave(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelLeaveDto,
  ) {
    return this.leaves.cancelMine(user, id, dto.comment);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Own attendance history (defaults to the last 30 days)' })
  myAttendance(
    @CurrentUser() user: AuthContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const end = to ?? todayUtc().toISOString().slice(0, 10);
    const start = from ?? new Date(todayUtc().getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
    return this.attendance.mine(user, start, end);
  }

  @Get('appraisals')
  myAppraisals(@CurrentUser() user: AuthContext) {
    return this.appraisals.listMine(user);
  }
}
