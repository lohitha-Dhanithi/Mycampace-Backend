import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurriculumSemesterCalendarService } from '../services/curriculum-semester-calendar.service';
import {
  CreateCurriculumDto, UpdateCurriculumDto,
  CreateSemesterDto, UpdateSemesterDto,
  CreateCalendarEventDto, UpdateCalendarEventDto,
} from '../dto/curriculum-semester-calendar.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Academic Curriculum / Semester / Calendar')
@ApiBearerAuth()
@Controller('academic')
export class CurriculumSemesterCalendarController {
  constructor(private readonly svc: CurriculumSemesterCalendarService) {}

  @Get('curricula')
  @RequirePermission('academic.curriculum.read')
  listCurricula(
    @CurrentUser() user: AuthContext,
    @Query('programId') programId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.svc.listCurricula(user, { programId, academicYearId, institutionId });
  }

  @Get('curricula/:id')
  @RequirePermission('academic.curriculum.read')
  getCurriculum(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getCurriculum(user, id);
  }

  @Post('curricula')
  @RequirePermission('academic.curriculum.manage')
  createCurriculum(@CurrentUser() user: AuthContext, @Body() dto: CreateCurriculumDto) {
    return this.svc.createCurriculum(user, dto);
  }

  @Patch('curricula/:id')
  @RequirePermission('academic.curriculum.manage')
  updateCurriculum(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCurriculumDto) {
    return this.svc.updateCurriculum(user, id, dto);
  }

  @Delete('curricula/:id')
  @RequirePermission('academic.curriculum.manage')
  archiveCurriculum(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.archiveCurriculum(user, id);
  }

  @Get('semesters')
  @RequirePermission('academic.semester.read')
  listSemesters(
    @CurrentUser() user: AuthContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.svc.listSemesters(user, { academicYearId, institutionId });
  }

  @Get('semesters/:id')
  @RequirePermission('academic.semester.read')
  getSemester(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getSemester(user, id);
  }

  @Post('semesters')
  @RequirePermission('academic.semester.manage')
  createSemester(@CurrentUser() user: AuthContext, @Body() dto: CreateSemesterDto) {
    return this.svc.createSemester(user, dto);
  }

  @Patch('semesters/:id')
  @RequirePermission('academic.semester.manage')
  updateSemester(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSemesterDto) {
    return this.svc.updateSemester(user, id, dto);
  }

  @Delete('semesters/:id')
  @RequirePermission('academic.semester.manage')
  archiveSemester(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.archiveSemester(user, id);
  }

  @Get('calendar')
  @RequirePermission('academic.calendar.read')
  listEvents(
    @CurrentUser() user: AuthContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.svc.listEvents(user, { academicYearId, institutionId, semesterId });
  }

  @Get('calendar/:id')
  @RequirePermission('academic.calendar.read')
  getEvent(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getEvent(user, id);
  }

  @Post('calendar')
  @RequirePermission('academic.calendar.manage')
  createEvent(@CurrentUser() user: AuthContext, @Body() dto: CreateCalendarEventDto) {
    return this.svc.createEvent(user, dto);
  }

  @Patch('calendar/:id')
  @RequirePermission('academic.calendar.manage')
  updateEvent(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.svc.updateEvent(user, id, dto);
  }

  @Delete('calendar/:id')
  @RequirePermission('academic.calendar.manage')
  archiveEvent(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.archiveEvent(user, id);
  }
}
