/** @deprecated Public HTTP moved to institution-service via gateway. */
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { BrandingController } from './controllers/branding.controller';
import { BrandingService } from './services/branding.service';
import { BrandingRepository } from './repositories/branding.repository';
import { ObjectStorageService } from '../../common/storage/object-storage.service';

@Module({
  imports: [IdentityModule],
  controllers: [] /* public APIs → institution-service :4002 */,
  providers: [BrandingService, BrandingRepository, ObjectStorageService],
  exports: [BrandingService],
})
export class BrandingModule {}
