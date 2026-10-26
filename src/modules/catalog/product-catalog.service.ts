import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

const CATALOG = [
  {
    id: 'academics',
    name: 'Academics',
    fullName: 'MyCampace Academics',
    category: 'core-academic',
    tagline: 'Academic structures, classes, curricula & faculty workload',
    description: 'Configure programs, courses, classes, and academic operations.',
    keyCapabilities: ['Programs', 'Courses', 'Timetable', 'Faculty workload'],
    route: '/app/academics',
  },
  {
    id: 'lms',
    name: 'LMS',
    fullName: 'MyCampace LMS',
    category: 'core-academic',
    tagline: 'Modern digital learning, multimedia lessons & assessments',
    description: 'Deliver courses, assignments, and learner analytics.',
    keyCapabilities: ['Courses', 'Assignments', 'Quizzes', 'Reports'],
    route: '/app/lms',
  },
  {
    id: 'finance',
    name: 'Finance',
    fullName: 'MyCampace Finance',
    category: 'finance-admin',
    tagline: 'Fee structures, collections, reconciliation & institutional finance',
    description: 'Manage fees, invoices, payments, and reconciliation.',
    keyCapabilities: ['Fee structures', 'Invoices', 'Payments', 'Dues'],
    route: '/app/finance',
  },
  {
    id: 'admissions',
    name: 'Admissions',
    fullName: 'MyCampace Admissions',
    category: 'core-academic',
    tagline: 'End-to-end recruitment funnel, counselling & digital applications',
    description: 'Track leads, applications, and enrolment pipeline.',
    keyCapabilities: ['Leads', 'Applications', 'Counselling', 'Documents'],
    route: '/app/admissions',
  },
  {
    id: 'hrms',
    name: 'HRMS',
    fullName: 'MyCampace HRMS',
    category: 'finance-admin',
    tagline: 'Employee records, leave policies, onboarding & performance',
    description: 'Staff directory, leave, attendance, and appraisals.',
    keyCapabilities: ['Staff', 'Leave', 'Attendance', 'Appraisals'],
    route: '/app/hrms',
  },
  {
    id: 'students',
    name: 'Students',
    fullName: 'MyCampace Students SIS',
    category: 'core-academic',
    tagline: 'Student records and lifecycle management',
    description: 'Student information system for enrolment and records.',
    keyCapabilities: ['Directory', 'Transfers', 'Promotions', 'Exits'],
    route: '/app/students',
  },
]

@Injectable()
export class ProductCatalogService implements OnModuleInit {
  private readonly logger = new Logger(ProductCatalogService.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureCatalog()
    } catch (error) {
      this.logger.warn(
        'Product catalog seed skipped. Configure DATABASE_URL and run prisma migrate.',
      )
    }
  }

  async ensureCatalog() {
    for (const product of CATALOG) {
      await this.prisma.product.upsert({
        where: { id: product.id },
        create: {
          ...product,
          plan: 'Professional',
          modulesCount: product.keyCapabilities.length,
        },
        update: {
          name: product.name,
          fullName: product.fullName,
          category: product.category,
          tagline: product.tagline,
          description: product.description,
          keyCapabilities: product.keyCapabilities,
          route: product.route,
        },
      })
    }
  }

  listIds() {
    return CATALOG.map((p) => p.id)
  }
}
