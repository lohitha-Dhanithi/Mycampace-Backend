import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from '../services/attendance.service';
import { AssignShiftDto, CreateShiftDto, UpdateShiftDto } from '../dto/hrms-setup.dto';
import { GenerateAttendanceDto, MarkAttendanceDto, UpdateAttendanceDto } from '../dto/attendance-appraisal.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import { todayUtc } from '../common/hrms.util';

@ApiTags('HRMS Attendance')
@ApiBearerAuth()
@Controller('hrms')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('shifts')
  @RequirePermission('hrms.attendance.read')
  listShifts(@CurrentUser() user: AuthContext, @Query('campusId') campusId?: string) {
    return this.attendance.listShifts(user, campusId);
  }

  @Post('shifts')
  @RequirePermission('hrms.attendance.manage')
  createShift(@CurrentUser() user: AuthContext, @Body() dto: CreateShiftDto) {
    return this.attendance.createShift(user, dto);
  }

  @Patch('shifts/:id')
  @RequirePermission('hrms.attendance.manage')
  updateShift(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.attendance.updateShift(user, id, dto);
  }

  @Delete('shifts/:id')
  @RequirePermission('hrms.attendance.manage')
  archiveShift(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.archiveShift(user, id);
  }

  @Post('shifts/:id/assignments')
  @RequirePermission('hrms.attendance.manage')
  @ApiOperation({ summary: 'Assign staff to a shift (closes their previous open assignment)' })
  assignShift(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignShiftDto,
  ) {
    return this.attendance.assignShift(user, id, dto);
  }

  @Get('attendance')
  @RequirePermission('hrms.attendance.read')
  @ApiOperation({ summary: "Day's attendance register (defaults to today)" })
  register(
    @CurrentUser() user: AuthContext,
    @Query('date') date?: string,
    @Query('campusId') campusId?: string,
  ) {
    return this.attendance.register(user, date ?? todayUtc().toISOString().slice(0, 10), campusId);
  }

  @Post('attendance/generate')
  @RequirePermission('hrms.attendance.manage')
  @ApiOperation({ summary: 'Seed the register for a date (idempotent)' })
  generate(@CurrentUser() user: AuthContext, @Body() dto: GenerateAttendanceDto) {
    return this.attendance.generate(user, dto);
  }

  @Post('attendance')
  @RequirePermission('hrms.attendance.manage')
  @ApiOperation({ summary: 'Mark (create or overwrite) one staff member attendance for a date' })
  mark(@CurrentUser() user: AuthContext, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(user, dto);
  }

  @Patch('attendance/:id')
  @RequirePermission('hrms.attendance.manage')
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendance.update(user, id, dto);
  }
}
