/** @deprecated Public HTTP moved to institution-service via gateway. */
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CampusController } from './controllers/campus.controller';
import { CampusService } from './services/campus.service';
import { CampusRepository } from './repositories/campus.repository';

@Module({
  imports: [IdentityModule],
  controllers: [] /* public APIs → institution-service :4002 */,
  providers: [CampusService, CampusRepository],
  exports: [CampusService],
})
export class CampusModule {}
