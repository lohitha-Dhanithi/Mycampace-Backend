// backend/src/modules/academics/academics.controller.ts
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { AcademicsService } from './academics.service'

@ApiTags('Academics')
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get('academic-years')
  @ApiOperation({ summary: 'Get configured academic years' })
  @ApiResponse({ status: 200, description: 'List of academic years' })
  async getAcademicYears() {
    return this.academicsService.getAcademicYears()
  }

  @Get('programs')
  @ApiOperation({ summary: 'Get academic programs (qualifications/pathways)' })
  @ApiResponse({ status: 200, description: 'List of programs' })
  async getPrograms(
    @Query('academicYearId') academicYearId?: string,
    @Query('campusId') campusId?: string,
  ) {
    return this.academicsService.getPrograms({ academicYearId, campusId })
  }

  @Get('courses')
  @ApiOperation({ summary: 'Get distinct curriculum courses under programs' })
  @ApiResponse({ status: 200, description: 'List of courses' })
  async getCourses(@Query('programId') programId?: string) {
    return this.academicsService.getCourses({ programId })
  }

  @Get('classes')
  @ApiOperation({ summary: 'Get academic levels/classes/semesters for a course' })
  @ApiResponse({ status: 200, description: 'List of classes' })
  async getClasses(@Query('courseId') courseId?: string) {
    return this.academicsService.getClasses({ courseId })
  }

  @Get('sections')
  @ApiOperation({ summary: 'Get sections for a class/cohort' })
  @ApiResponse({ status: 200, description: 'List of sections' })
  async getSections(@Query('classId') classId?: string) {
    return this.academicsService.getSections({ classId })
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Get master subjects catalog' })
  @ApiResponse({ status: 200, description: 'List of subjects' })
  async getSubjects(@Query('department') department?: string) {
    return this.academicsService.getSubjects({ department })
  }

  @Get('curriculum-subjects')
  @ApiOperation({ summary: 'Get mapped compulsory and elective subjects for course/class' })
  @ApiResponse({ status: 200, description: 'Mapped curriculum subjects' })
  async getCurriculumSubjects(
    @Query('courseId') courseId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.academicsService.getCurriculumSubjects(courseId, classId)
  }

  @Get('workload')
  @ApiOperation({ summary: 'Get faculty teaching load and timetable distribution' })
  @ApiResponse({ status: 200, description: 'Faculty workload index' })
  async getWorkload() {
    return this.academicsService.getFacultyWorkload()
  }
}
