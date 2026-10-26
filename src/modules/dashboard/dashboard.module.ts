/** @deprecated Public HTTP moved to admissions-service via gateway. */
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdmissionsModule } from '../admissions/admissions.module';
import { InstitutionModule } from '../institution/institution.module';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [IdentityModule, AdmissionsModule, InstitutionModule],
  controllers: [] /* public APIs → admissions-service :4003 */,
  providers: [DashboardService],
})
export class DashboardModule {}
