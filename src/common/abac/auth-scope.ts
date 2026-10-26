/**
 * ABAC scope abstraction (PRD Ch.3.8).
 * RBAC = what; ABAC = where/which resources.
 * Domain resource tables (class, hostel, route) plug in later.
 */

export type ScopeLevel =
  | 'PLATFORM'
  | 'TENANT'
  | 'CAMPUS'
  | 'DEPARTMENT'
  | 'OWN_RECORD'
  | 'ASSIGNED_RESOURCE'
  | 'RELATIONSHIP';

export interface AuthScope {
  tenantId: string;
  /** When set, caller is constrained to this campus (e.g. PRINCIPAL). */
  campusIds?: string[];
  departmentIds?: string[];
  /** Resource type keys e.g. class, hostel, route — empty until domains exist */
  assignedResourceIds?: Record<string, string[]>;
  /** Linked student user IDs for PARENT/GUARDIAN */
  linkedStudentIds?: string[];
  /** Own user id for self-scope */
  ownUserId?: string;
}

export interface ScopeCheckInput {
  tenantId: string;
  campusId?: string;
  departmentId?: string;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: string;
  studentUserId?: string;
}
