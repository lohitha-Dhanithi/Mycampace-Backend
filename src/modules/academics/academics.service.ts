// backend/src/modules/academics/academics.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisCacheService } from '@/cache/redis-cache.service'

@Injectable()
export class AcademicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  // 1. Academic Years
  async getAcademicYears() {
    return [
      { id: 'ay-2026', name: '2026–27', startDate: '2026-06-01', endDate: '2027-04-30', isCurrent: true, status: 'Active', admissionStatus: 'Open' },
      { id: 'ay-2025', name: '2025–26', startDate: '2025-06-01', endDate: '2026-04-30', isCurrent: false, status: 'Closed', admissionStatus: 'Closed' },
      { id: 'ay-2027', name: '2027–28', startDate: '2027-06-01', endDate: '2028-04-30', isCurrent: false, status: 'Upcoming', admissionStatus: 'Upcoming' },
    ]
  }

  // 2. Programs (Overall academic pathway/qualification)
  async getPrograms(filter?: { academicYearId?: string; campusId?: string }) {
    const list = [
      {
        id: 'prog-1',
        academicYearId: 'ay-2026',
        name: 'Senior Secondary Education (CBSE)',
        code: 'PROG-SR-SEC',
        level: 'High School (Grades 11-12)',
        description: 'Two-year curriculum framework preparing students for higher education.',
        durationYears: 2,
        duration: '2 Years',
        admissionAvailable: true,
        intakeCapacity: 160,
        status: 'Active',
      },
      {
        id: 'prog-2',
        academicYearId: 'ay-2026',
        name: 'Secondary Education (CBSE)',
        code: 'PROG-SEC',
        level: 'Middle & Secondary (Grades 6-10)',
        description: 'Comprehensive secondary school curriculum foundation.',
        durationYears: 5,
        duration: '5 Years',
        admissionAvailable: true,
        intakeCapacity: 200,
        status: 'Active',
      },
      {
        id: 'prog-3',
        academicYearId: 'ay-2026',
        name: 'Undergraduate Engineering (B.Tech)',
        code: 'PROG-BTECH',
        level: 'Higher Ed (Undergraduate)',
        description: 'Four-year degree program with specialized technology disciplines.',
        durationYears: 4,
        duration: '4 Years',
        admissionAvailable: true,
        intakeCapacity: 240,
        status: 'Active',
      },
      {
        id: 'prog-4',
        academicYearId: 'ay-2026',
        name: 'Bachelor of Commerce (B.Com)',
        code: 'PROG-BCOM',
        level: 'Higher Ed (Undergraduate)',
        description: 'Three-year commerce and business analytics degree.',
        durationYears: 3,
        duration: '3 Years',
        admissionAvailable: true,
        intakeCapacity: 120,
        status: 'Active',
      },
      {
        id: 'prog-5',
        academicYearId: 'ay-2026',
        name: 'Primary Foundation',
        code: 'PROG-PRI',
        level: 'Primary (Grades 1-5)',
        description: 'Foundational learning and cognitive development program.',
        durationYears: 5,
        duration: '5 Years',
        admissionAvailable: true,
        intakeCapacity: 150,
        status: 'Active',
      },
    ]

    if (filter?.academicYearId) {
      return list.filter((p) => p.academicYearId === filter.academicYearId || !p.academicYearId)
    }
    return list
  }

  // 3. Courses (Distinct curriculum offerings within a program)
  async getCourses(filter?: { programId?: string }) {
    const list = [
      {
        id: 'crs-1',
        programId: 'prog-1',
        name: 'Higher Secondary — Science Stream (PCM / PCB)',
        code: 'CRS-SCI-1112',
        department: 'Science',
        duration: '2 Years',
        credits: 4,
        admissionAvailable: true,
        intakeCapacity: 80,
        status: 'Active',
      },
      {
        id: 'crs-2',
        programId: 'prog-1',
        name: 'Higher Secondary — Commerce Stream',
        code: 'CRS-COM-1112',
        department: 'Commerce',
        duration: '2 Years',
        credits: 4,
        admissionAvailable: true,
        intakeCapacity: 40,
        status: 'Active',
      },
      {
        id: 'crs-3',
        programId: 'prog-1',
        name: 'Higher Secondary — Humanities & Arts',
        code: 'CRS-HUM-1112',
        department: 'Humanities',
        duration: '2 Years',
        credits: 4,
        admissionAvailable: true,
        intakeCapacity: 40,
        status: 'Active',
      },
      {
        id: 'crs-4',
        programId: 'prog-2',
        name: 'Secondary Education Curriculum (Grades 9 & 10)',
        code: 'CRS-SEC-0910',
        department: 'General Academics',
        duration: '2 Years',
        credits: 4,
        admissionAvailable: true,
        intakeCapacity: 120,
        status: 'Active',
      },
      {
        id: 'crs-5',
        programId: 'prog-2',
        name: 'Middle School Curriculum (Grades 6 to 8)',
        code: 'CRS-MID-0608',
        department: 'General Academics',
        duration: '3 Years',
        credits: 4,
        admissionAvailable: true,
        intakeCapacity: 120,
        status: 'Active',
      },
      {
        id: 'crs-6',
        programId: 'prog-3',
        name: 'B.Tech in Computer Science & Engineering',
        code: 'CRS-BTECH-CSE',
        department: 'Computer Science',
        duration: '4 Years',
        credits: 160,
        admissionAvailable: true,
        intakeCapacity: 120,
        status: 'Active',
      },
      {
        id: 'crs-7',
        programId: 'prog-3',
        name: 'B.Tech in Electronics & Communication',
        code: 'CRS-BTECH-ECE',
        department: 'Engineering',
        duration: '4 Years',
        credits: 160,
        admissionAvailable: true,
        intakeCapacity: 60,
        status: 'Active',
      },
      {
        id: 'crs-8',
        programId: 'prog-4',
        name: 'B.Com General & Financial Accounting',
        code: 'CRS-BCOM-GEN',
        department: 'Commerce',
        duration: '3 Years',
        credits: 120,
        admissionAvailable: true,
        intakeCapacity: 120,
        status: 'Active',
      },
    ]

    if (filter?.programId) {
      return list.filter((c) => c.programId === filter.programId)
    }
    return list
  }

  // 4. Classes (Applicable academic level or cohort)
  async getClasses(filter?: { courseId?: string }) {
    const list = [
      { id: 'cls-12', courseId: 'crs-1', name: 'Class 12', code: 'GR-12', program: 'Senior Secondary Education (CBSE)', levelOrder: 12, sectionsCount: 2, totalStudents: 74, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-11', courseId: 'crs-1', name: 'Class 11', code: 'GR-11', program: 'Senior Secondary Education (CBSE)', levelOrder: 11, sectionsCount: 2, totalStudents: 78, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-10', courseId: 'crs-4', name: 'Class 10', code: 'GR-10', program: 'Secondary Education (CBSE)', levelOrder: 10, sectionsCount: 3, totalStudents: 124, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-9', courseId: 'crs-4', name: 'Class 9', code: 'GR-09', program: 'Secondary Education (CBSE)', levelOrder: 9, sectionsCount: 3, totalStudents: 118, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-8', courseId: 'crs-5', name: 'Class 8', code: 'GR-08', program: 'Secondary Education (CBSE)', levelOrder: 8, sectionsCount: 2, totalStudents: 80, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-sem1-cse', courseId: 'crs-6', name: 'Semester 1 (First Year)', code: 'CSE-SEM-01', program: 'Undergraduate Engineering (B.Tech)', levelOrder: 1, sectionsCount: 2, totalStudents: 115, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-sem2-cse', courseId: 'crs-6', name: 'Semester 2', code: 'CSE-SEM-02', program: 'Undergraduate Engineering (B.Tech)', levelOrder: 2, sectionsCount: 2, totalStudents: 112, campus: 'Hyderabad Main Campus', status: 'Active' },
      { id: 'cls-sem1-bcom', courseId: 'crs-8', name: 'Year 1 / Semester 1', code: 'BCOM-SEM-01', program: 'Bachelor of Commerce (B.Com)', levelOrder: 1, sectionsCount: 2, totalStudents: 90, campus: 'Hyderabad Main Campus', status: 'Active' },
    ]

    if (filter?.courseId) {
      return list.filter((cls) => cls.courseId === filter.courseId)
    }
    return list
  }

  // 5. Sections (Divisions within a class or cohort)
  async getSections(filter?: { classId?: string }) {
    const list = [
      { id: 'sec-12A', classId: 'cls-12', className: 'Class 12', name: 'Section A (PCM)', room: 'Room 301, Block C', classTeacher: 'Pooja Iyer', capacity: 40, currentStrength: 38, status: 'Active' },
      { id: 'sec-12B', classId: 'cls-12', className: 'Class 12', name: 'Section B (PCB)', room: 'Room 302, Block C', classTeacher: 'Dr. Suresh Kumar', capacity: 40, currentStrength: 36, status: 'Active' },
      { id: 'sec-11A', classId: 'cls-11', className: 'Class 11', name: 'Section A (PCM)', room: 'Room 201, Block C', classTeacher: 'Arvind Swamy', capacity: 40, currentStrength: 39, status: 'Active' },
      { id: 'sec-11B', classId: 'cls-11', className: 'Class 11', name: 'Section B (PCB)', room: 'Room 202, Block C', classTeacher: 'Meera Nambiar', capacity: 40, currentStrength: 39, status: 'Active' },
      { id: 'sec-10A', classId: 'cls-10', className: 'Class 10', name: 'Section A', room: 'Room 105, Block B', classTeacher: 'Kavita Chawla', capacity: 45, currentStrength: 42, status: 'Active' },
      { id: 'sec-10B', classId: 'cls-10', className: 'Class 10', name: 'Section B', room: 'Room 106, Block B', classTeacher: 'Manoj Pillai', capacity: 45, currentStrength: 41, status: 'Active' },
      { id: 'sec-cse-1a', classId: 'cls-sem1-cse', className: 'Semester 1 (First Year)', name: 'Section 1A', room: 'Turing Hall, Tech Block', classTeacher: 'Dr. Meenakshi Sundaram', capacity: 60, currentStrength: 58, status: 'Active' },
      { id: 'sec-cse-1b', classId: 'cls-sem1-cse', className: 'Semester 1 (First Year)', name: 'Section 1B', room: 'Babbage Hall, Tech Block', classTeacher: 'Prof. S. N. Varma', capacity: 60, currentStrength: 57, status: 'Active' },
    ]

    if (filter?.classId) {
      return list.filter((s) => s.classId === filter.classId)
    }
    return list
  }

  // 6. Subjects (Independent master entities)
  async getSubjects(filter?: { department?: string }) {
    const list = [
      { id: 'sub-phy', name: 'Physics (Theory & Lab)', code: 'PHY-042', department: 'Science', type: 'Theory + Practical', credits: 4, weeklyHours: 6, status: 'Active' },
      { id: 'sub-chem', name: 'Chemistry (Theory & Lab)', code: 'CHE-043', department: 'Science', type: 'Theory + Practical', credits: 4, weeklyHours: 6, status: 'Active' },
      { id: 'sub-math', name: 'Mathematics Core', code: 'MAT-041', department: 'Mathematics', type: 'Theory', credits: 4, weeklyHours: 7, status: 'Active' },
      { id: 'sub-bio', name: 'Biology', code: 'BIO-044', department: 'Science', type: 'Theory + Practical', credits: 4, weeklyHours: 6, status: 'Active' },
      { id: 'sub-eng', name: 'English Core & Communication', code: 'ENG-301', department: 'Languages', type: 'Theory', credits: 3, weeklyHours: 5, status: 'Active' },
      { id: 'sub-cs', name: 'Computer Science (Python & SQL)', code: 'CSC-083', department: 'Computer Science', type: 'Theory + Practical', credits: 4, weeklyHours: 5, status: 'Active' },
      { id: 'sub-acc', name: 'Financial Accounting & Reporting', code: 'ACC-101', department: 'Commerce', type: 'Theory', credits: 4, weeklyHours: 6, status: 'Active' },
      { id: 'sub-dsa', name: 'Data Structures & Algorithms', code: 'CSE-201', department: 'Computer Science', type: 'Theory + Practical', credits: 4, weeklyHours: 6, status: 'Active' },
      { id: 'sub-ai', name: 'Artificial Intelligence & Machine Learning', code: 'CSE-401', department: 'Computer Science', type: 'Theory + Practical', credits: 3, weeklyHours: 4, status: 'Active' },
      { id: 'sub-cyber', name: 'Cybersecurity Fundamentals', code: 'CSE-402', department: 'Computer Science', type: 'Theory', credits: 3, weeklyHours: 4, status: 'Active' },
    ]

    if (filter?.department) {
      return list.filter((s) => s.department === filter.department)
    }
    return list
  }

  // 7. Curriculum Subject Mappings (Mapping Subjects to Courses/Classes)
  async getCurriculumSubjects(courseId?: string, classId?: string) {
    const mappings = [
      // Class 11 / Class 12 Science (CRS-SCI-1112)
      { id: 'cur-1', courseId: 'crs-1', classId: 'cls-11', subjectId: 'sub-phy', subjectName: 'Physics (Theory & Lab)', subjectCode: 'PHY-042', subjectType: 'Compulsory', credits: 4 },
      { id: 'cur-2', courseId: 'crs-1', classId: 'cls-11', subjectId: 'sub-chem', subjectName: 'Chemistry (Theory & Lab)', subjectCode: 'CHE-043', subjectType: 'Compulsory', credits: 4 },
      { id: 'cur-3', courseId: 'crs-1', classId: 'cls-11', subjectId: 'sub-math', subjectName: 'Mathematics Core', subjectCode: 'MAT-041', subjectType: 'Compulsory', credits: 4 },
      { id: 'cur-4', courseId: 'crs-1', classId: 'cls-11', subjectId: 'sub-eng', subjectName: 'English Core & Communication', subjectCode: 'ENG-301', subjectType: 'Compulsory', credits: 3 },
      { id: 'cur-5', courseId: 'crs-1', classId: 'cls-11', subjectId: 'sub-cs', subjectName: 'Computer Science (Python & SQL)', subjectCode: 'CSC-083', subjectType: 'Elective', credits: 4 },
      { id: 'cur-6', courseId: 'crs-1', classId: 'cls-11', subjectId: 'sub-bio', subjectName: 'Biology', subjectCode: 'BIO-044', subjectType: 'Elective', credits: 4 },

      // B.Tech CSE (CRS-BTECH-CSE)
      { id: 'cur-7', courseId: 'crs-6', classId: 'cls-sem1-cse', subjectId: 'sub-dsa', subjectName: 'Data Structures & Algorithms', subjectCode: 'CSE-201', subjectType: 'Compulsory', credits: 4 },
      { id: 'cur-8', courseId: 'crs-6', classId: 'cls-sem1-cse', subjectId: 'sub-math', subjectName: 'Mathematics Core', subjectCode: 'MAT-041', subjectType: 'Compulsory', credits: 4 },
      { id: 'cur-9', courseId: 'crs-6', classId: 'cls-sem1-cse', subjectId: 'sub-ai', subjectName: 'Artificial Intelligence & Machine Learning', subjectCode: 'CSE-401', subjectType: 'Elective', credits: 3 },
      { id: 'cur-10', courseId: 'crs-6', classId: 'cls-sem1-cse', subjectId: 'sub-cyber', subjectName: 'Cybersecurity Fundamentals', subjectCode: 'CSE-402', subjectType: 'Elective', credits: 3 },

      // B.Com (CRS-BCOM-GEN)
      { id: 'cur-11', courseId: 'crs-8', classId: 'cls-sem1-bcom', subjectId: 'sub-acc', subjectName: 'Financial Accounting & Reporting', subjectCode: 'ACC-101', subjectType: 'Compulsory', credits: 4 },
      { id: 'cur-12', courseId: 'crs-8', classId: 'cls-sem1-bcom', subjectId: 'sub-eng', subjectName: 'English Core & Communication', subjectCode: 'ENG-301', subjectType: 'Compulsory', credits: 3 },
    ]

    let results = mappings
    if (courseId) {
      results = results.filter((m) => m.courseId === courseId)
    }
    if (classId) {
      results = results.filter((m) => m.classId === classId || !m.classId)
    }
    return results
  }

  // 8. Workload Index
  async getFacultyWorkload() {
    return [
      { facultyId: 'fac-1', name: 'Dr. Meenakshi Sundaram', weeklyHours: 18, assignedClasses: 4, workloadIndex: 'Optimal (85%)' },
      { facultyId: 'fac-2', name: 'Prof. S. N. Varma', weeklyHours: 22, assignedClasses: 5, workloadIndex: 'High (95%)' },
      { facultyId: 'fac-3', name: 'Pooja Iyer', weeklyHours: 16, assignedClasses: 3, workloadIndex: 'Optimal (80%)' },
      { facultyId: 'fac-4', name: 'Arvind Swamy', weeklyHours: 17, assignedClasses: 4, workloadIndex: 'Optimal (82%)' },
    ]
  }
}
