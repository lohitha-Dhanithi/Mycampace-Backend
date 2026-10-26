import { Module } from '@nestjs/common'
import { PrivateDocumentStorage } from './private-document-storage.service'
import { VerificationService } from './verification.service'
import { SuperadminVerificationController, VerificationController } from './verification.controller'

@Module({
  controllers: [VerificationController, SuperadminVerificationController],
  providers: [VerificationService, PrivateDocumentStorage],
  exports: [VerificationService],
})
export class VerificationModule {}
