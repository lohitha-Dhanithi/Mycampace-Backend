import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';
import { AcademicYearController } from './controllers/academic-year.controller';
import { AcademicYearService } from './services/academic-year.service';
import { AcademicYearRepository } from './repositories/academic-year.repository';
import { DepartmentController } from './controllers/department.controller';
import { DepartmentService } from './services/department.service';
import { DepartmentRepository } from './repositories/department.repository';
import { ProgramCourseSubjectController } from './controllers/program-course-subject.controller';
import { ProgramCourseSubjectService } from './services/program-course-subject.service';
import { ProgramCourseSubjectRepository } from './repositories/program-course-subject.repository';
import { CurriculumSemesterCalendarController } from './controllers/curriculum-semester-calendar.controller';
import { CurriculumSemesterCalendarService } from './services/curriculum-semester-calendar.service';
import { CurriculumSemesterCalendarRepository } from './repositories/curriculum-semester-calendar.repository';

@Module({
  imports: [IdentityModule, AuditModule],
  controllers: [] /* cut over to academic-service :4005 */,
  providers: [
    AcademicYearService, AcademicYearRepository,
    DepartmentService, DepartmentRepository,
    ProgramCourseSubjectService, ProgramCourseSubjectRepository,
    CurriculumSemesterCalendarService, CurriculumSemesterCalendarRepository,
  ],
  exports: [
    AcademicYearService, DepartmentService,
    ProgramCourseSubjectService, CurriculumSemesterCalendarService,
  ],
})
export class AcademicModule {}
