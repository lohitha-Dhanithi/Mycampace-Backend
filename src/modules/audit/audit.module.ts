import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';
import { AuthorizationScopeService } from '../../common/abac/authorization-scope.service';

@Global()
@Module({
  providers: [AuditService, AuditRepository, AuthorizationScopeService],
  exports: [AuditService, AuthorizationScopeService],
})
export class AuditModule {}
