import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AuditModule } from '../audit/audit.module';
import { HrmsSetupController } from './controllers/hrms-setup.controller';
import { StaffController } from './controllers/staff.controller';
import { LeaveController } from './controllers/leave.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { AppraisalController } from './controllers/appraisal.controller';
import { HrmsMeController } from './controllers/hrms-me.controller';
import { HrmsDashboardController } from './controllers/hrms-dashboard.controller';
import { HrmsSetupService } from './services/hrms-setup.service';
import { StaffService } from './services/staff.service';
import { LeaveService } from './services/leave.service';
import { AttendanceService } from './services/attendance.service';
import { AppraisalService } from './services/appraisal.service';
import { HrmsDashboardService } from './services/hrms-dashboard.service';
import { HrmsSetupRepository } from './repositories/hrms-setup.repository';
import { StaffRepository } from './repositories/staff.repository';
import { LeaveRepository } from './repositories/leave.repository';
import { AttendanceRepository } from './repositories/attendance.repository';
import { AppraisalRepository } from './repositories/appraisal.repository';

@Module({
  imports: [IdentityModule, AuditModule],
  controllers: [
    HrmsSetupController,
    StaffController,
    LeaveController,
    AttendanceController,
    AppraisalController,
    HrmsMeController,
    HrmsDashboardController,
  ],
  providers: [
    HrmsSetupService, HrmsSetupRepository,
    StaffService, StaffRepository,
    LeaveService, LeaveRepository,
    AttendanceService, AttendanceRepository,
    AppraisalService, AppraisalRepository,
    HrmsDashboardService,
  ],
  exports: [StaffService, LeaveService, AppraisalService],
})
export class HrmsModule {}
