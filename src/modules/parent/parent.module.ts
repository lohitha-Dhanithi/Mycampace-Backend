/** @deprecated Public HTTP moved to portal-service via gateway. */
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ParentController } from './controllers/parent.controller';
import { ParentService } from './services/parent.service';
import { ParentRepository } from './repositories/parent.repository';

@Module({
  imports: [IdentityModule],
  controllers: [] /* public APIs → portal-service :4004 */,
  providers: [ParentService, ParentRepository],
  exports: [ParentService],
})
export class ParentModule {}
