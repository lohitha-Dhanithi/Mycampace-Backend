// backend/src/modules/admissions/admissions.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { AdmissionsService } from './admissions.service'

@ApiTags('Admissions')
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get('leads')
  @ApiOperation({ summary: 'Get CRM inquiries and lead records' })
  @ApiResponse({ status: 200, description: 'List of leads' })
  async getLeads() {
    return this.admissionsService.getLeads()
  }

  @Get('applications')
  @ApiOperation({ summary: 'Get online admissions applications and verification state' })
  @ApiResponse({ status: 200, description: 'List of applications' })
  async getApplications() {
    return this.admissionsService.getApplications()
  }

  @Post('validate-academic-selection')
  @ApiOperation({ summary: 'Validate cascading academic entity selection for an application' })
  @ApiResponse({ status: 200, description: 'Validation status' })
  async validateAcademicSelection(
    @Body() payload: {
      academicYearId: string
      campusId?: string
      programId: string
      courseId: string
      classId?: string
      electiveSubjectIds?: string[]
    },
  ) {
    return this.admissionsService.validateAcademicSelection(payload)
  }

  @Post('enrol')
  @ApiOperation({ summary: 'Enrol admitted applicant into section and curriculum subjects' })
  @ApiResponse({ status: 201, description: 'Enrolment record created' })
  async enrolStudent(
    @Body() payload: { applicationId: string; sectionId: string },
  ) {
    return this.admissionsService.approveAndEnrolStudent(payload.applicationId, payload.sectionId)
  }
}
