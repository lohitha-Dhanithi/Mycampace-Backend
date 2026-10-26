/** @deprecated Public HTTP moved to institution-service via gateway. */
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InstitutionController } from './controllers/institution.controller';
import { InstitutionService } from './services/institution.service';
import { InstitutionRepository } from './repositories/institution.repository';

@Module({
  imports: [IdentityModule],
  controllers: [] /* public APIs → institution-service :4002 */,
  providers: [InstitutionService, InstitutionRepository],
  exports: [InstitutionService, InstitutionRepository],
})
export class InstitutionModule {}
