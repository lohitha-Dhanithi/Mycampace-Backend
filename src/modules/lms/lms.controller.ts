// backend/src/modules/lms/lms.controller.ts
import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { LmsService } from './lms.service'

@ApiTags('LMS')
@Controller('lms')
export class LmsController {
  constructor(private readonly lmsService: LmsService) {}

  @Get('courses')
  @ApiOperation({ summary: 'Get digital courses, multimedia modules and content' })
  @ApiResponse({ status: 200, description: 'List of LMS courses' })
  async getCourses() {
    return this.lmsService.getCourses()
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get global assignments and submission statistics' })
  @ApiResponse({ status: 200, description: 'List of assignments' })
  async getAssignments() {
    return this.lmsService.getAssignments()
  }
}
