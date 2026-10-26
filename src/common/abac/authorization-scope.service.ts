import { Injectable } from '@nestjs/common';
import { AuthScope, ScopeCheckInput } from './auth-scope';

/**
 * Foundation ABAC checks. Does not invent domain tables.
 * Future: edu.sp_authz_scope_check
 */
@Injectable()
export class AuthorizationScopeService {
  /**
   * Tenant boundary — always required for tenant-owned data.
   */
  assertSameTenant(scope: AuthScope, tenantId: string): boolean {
    return scope.tenantId === tenantId;
  }

  /**
   * Campus constraint: if scope has campusIds, target campus must be included.
   * If scope has no campusIds, treated as tenant-wide (leadership).
   */
  canAccessCampus(scope: AuthScope, campusId: string | undefined): boolean {
    if (!campusId) return true;
    if (!scope.campusIds || scope.campusIds.length === 0) return true;
    return scope.campusIds.includes(campusId);
  }

  canAccessOwnRecord(scope: AuthScope, targetUserId: string): boolean {
    return !!scope.ownUserId && scope.ownUserId === targetUserId;
  }

  canAccessLinkedStudent(scope: AuthScope, studentUserId: string): boolean {
    return !!scope.linkedStudentIds?.includes(studentUserId);
  }

  canAccessAssignedResource(
    scope: AuthScope,
    resourceType: string,
    resourceId: string,
  ): boolean {
    const ids = scope.assignedResourceIds?.[resourceType];
    if (!ids || ids.length === 0) return false;
    return ids.includes(resourceId);
  }

  evaluate(scope: AuthScope, input: ScopeCheckInput): boolean {
    if (!this.assertSameTenant(scope, input.tenantId)) return false;
    if (input.campusId && !this.canAccessCampus(scope, input.campusId)) {
      return false;
    }
    if (input.targetUserId && scope.ownUserId) {
      // own-record style checks only when ownUserId is the constraint in use
    }
    if (input.studentUserId) {
      return this.canAccessLinkedStudent(scope, input.studentUserId);
    }
    if (input.resourceType && input.resourceId) {
      return this.canAccessAssignedResource(
        scope,
        input.resourceType,
        input.resourceId,
      );
    }
    return true;
  }
}
