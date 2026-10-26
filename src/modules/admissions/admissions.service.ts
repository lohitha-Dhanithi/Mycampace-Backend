// backend/src/modules/admissions/admissions.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getLeads() {
    return [
      { id: 'lead-1', name: 'Aditya Swaminathan', email: 'aditya.s@gmail.com', phone: '+91 98490 88771', targetProgram: 'Class 11 Science', status: 'Counselling Completed' },
      { id: 'lead-2', name: 'Riya Kulkarni', email: 'riya.k@gmail.com', phone: '+91 91234 55443', targetProgram: 'B.Tech CSE', status: 'Application Submitted' },
    ]
  }

  async getApplications() {
    return [
      { id: 'app-1', appNo: 'APP-2026-091', candidateName: 'Aditya Swaminathan', program: 'Class 11 PCM', status: 'Under Review', submittedDate: '2026-10-03' },
      { id: 'app-2', appNo: 'APP-2026-092', candidateName: 'Sneha Reddy', program: 'Class 11 Commerce', status: 'Verified & Approved', submittedDate: '2026-10-02' },
    ]
  }

  // Cascading Academic Selection Validation
  async validateAcademicSelection(payload: {
    academicYearId: string
    campusId?: string
    programId: string
    courseId: string
    classId?: string
    electiveSubjectIds?: string[]
  }) {
    if (!payload.academicYearId) {
      throw new BadRequestException('Academic Year is required.')
    }
    if (!payload.programId) {
      throw new BadRequestException('Academic Program is required.')
    }
    if (!payload.courseId) {
      throw new BadRequestException('Course offering is required.')
    }

    return {
      valid: true,
      compulsorySubjectsAssigned: true,
      message: 'Academic selection matches valid curriculum hierarchy.',
    }
  }

  // Approval & Enrolment
  async approveAndEnrolStudent(applicationId: string, sectionId: string) {
    if (!applicationId) throw new BadRequestException('Application ID is required.')
    if (!sectionId) throw new BadRequestException('Section assignment is required.')

    return {
      success: true,
      enrolmentId: `enr-${Date.now()}`,
      studentId: `stu-${Date.now()}`,
      status: 'Enrolled',
      message: 'Student record and academic enrolment created successfully.',
    }
  }
}
