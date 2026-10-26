import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProgramCourseSubjectService } from '../services/program-course-subject.service';
import {
  CreateProgramDto, UpdateProgramDto,
  CreateCourseDto, UpdateCourseDto,
  CreateSubjectDto, UpdateSubjectDto,
} from '../dto/program-course-subject.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Academic Programs / Courses / Subjects')
@ApiBearerAuth()
@Controller('academic')
export class ProgramCourseSubjectController {
  constructor(private readonly svc: ProgramCourseSubjectService) {}

  // Programs
  @Get('programs')
  @RequirePermission('academic.program.read')
  listPrograms(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.svc.listPrograms(user, { institutionId, departmentId });
  }

  @Get('programs/:id')
  @RequirePermission('academic.program.read')
  getProgram(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getProgram(user, id);
  }

  @Post('programs')
  @RequirePermission('academic.program.manage')
  createProgram(@CurrentUser() user: AuthContext, @Body() dto: CreateProgramDto) {
    return this.svc.createProgram(user, dto);
  }

  @Patch('programs/:id')
  @RequirePermission('academic.program.manage')
  updateProgram(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.svc.updateProgram(user, id, dto);
  }

  @Delete('programs/:id')
  @RequirePermission('academic.program.manage')
  archiveProgram(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.archiveProgram(user, id);
  }

  // Courses
  @Get('courses')
  @RequirePermission('academic.course.read')
  listCourses(
    @CurrentUser() user: AuthContext,
    @Query('programId') programId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.svc.listCourses(user, { programId, institutionId });
  }

  @Get('courses/:id')
  @RequirePermission('academic.course.read')
  getCourse(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getCourse(user, id);
  }

  @Post('courses')
  @RequirePermission('academic.course.manage')
  createCourse(@CurrentUser() user: AuthContext, @Body() dto: CreateCourseDto) {
    return this.svc.createCourse(user, dto);
  }

  @Patch('courses/:id')
  @RequirePermission('academic.course.manage')
  updateCourse(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.svc.updateCourse(user, id, dto);
  }

  @Delete('courses/:id')
  @RequirePermission('academic.course.manage')
  archiveCourse(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.archiveCourse(user, id);
  }

  // Subjects
  @Get('subjects')
  @RequirePermission('academic.subject.read')
  listSubjects(
    @CurrentUser() user: AuthContext,
    @Query('courseId') courseId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.svc.listSubjects(user, { courseId, institutionId });
  }

  @Get('subjects/:id')
  @RequirePermission('academic.subject.read')
  getSubject(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getSubject(user, id);
  }

  @Post('subjects')
  @RequirePermission('academic.subject.manage')
  createSubject(@CurrentUser() user: AuthContext, @Body() dto: CreateSubjectDto) {
    return this.svc.createSubject(user, dto);
  }

  @Patch('subjects/:id')
  @RequirePermission('academic.subject.manage')
  updateSubject(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.svc.updateSubject(user, id, dto);
  }

  @Delete('subjects/:id')
  @RequirePermission('academic.subject.manage')
  archiveSubject(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.archiveSubject(user, id);
  }
}
