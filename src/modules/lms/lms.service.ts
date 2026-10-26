// backend/src/modules/lms/lms.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'

@Injectable()
export class LmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getCourses() {
    return [
      { id: 'lms-crs-1', title: 'AP Physics C: Mechanics & Waves', instructor: 'Dr. Meenakshi S.', modulesCount: 6, enrolledStudents: 142 },
      { id: 'lms-crs-2', title: 'Data Structures & Algorithms in Java', instructor: 'Prof. S. N. Varma', modulesCount: 10, enrolledStudents: 210 },
      { id: 'lms-crs-3', title: 'Biochemistry & Molecular Genetics', instructor: 'Dr. Radhakrishnan', modulesCount: 8, enrolledStudents: 95 },
    ]
  }

  async getAssignments() {
    return [
      { id: 'asg-1', title: 'Differential Calculus Problem Set 3', courseTitle: 'AP Physics C', dueDate: '2026-10-15', submissionsCount: 28 },
      { id: 'asg-2', title: 'Binary Search Trees & AVL Balancing', courseTitle: 'Data Structures', dueDate: '2026-10-18', submissionsCount: 54 },
    ]
  }
}
