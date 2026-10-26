/**
 * PRD Chapter 3 role catalog invariants.
 * Speculative roles must not be treated as active canonical tenant roles.
 */

const CANONICAL_PRD_ROLES = [
  'FOUNDER',
  'CHAIRMAN',
  'TRUSTEE',
  'BOARD_MEMBER',
  'MANAGING_DIRECTOR',
  'CEO',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'DEAN',
  'REGISTRAR',
  'ACADEMIC_DIRECTOR',
  'EXAMINATION_CONTROLLER',
  'ADMISSION_MANAGER',
  'COUNSELLOR',
  'RECEPTIONIST',
  'FINANCE_MANAGER',
  'ACCOUNTANT',
  'HR_MANAGER',
  'PAYROLL_OFFICER',
  'PROCUREMENT_OFFICER',
  'INVENTORY_MANAGER',
  'HEAD_OF_DEPARTMENT',
  'PROFESSOR',
  'ASSOCIATE_PROFESSOR',
  'ASSISTANT_PROFESSOR',
  'SCHOOL_TEACHER',
  'VISITING_FACULTY',
  'GUEST_FACULTY',
  'CONTRACT_TEACHER',
  'LAB_INSTRUCTOR',
  'HOSTEL_WARDEN',
  'LIBRARIAN',
  'TRANSPORT_MANAGER',
  'DRIVER',
  'SECURITY_STAFF',
  'MAINTENANCE_STAFF',
  'STUDENT',
  'PARENT',
  'GUARDIAN',
  'ALUMNI',
  'VENDOR',
  'FINANCE_PARTNER',
  'RECRUITER',
  'ACCREDITATION_AUDITOR',
  'GOVERNMENT_OFFICER',
] as const;

const FORBIDDEN_AS_CANONICAL = [
  'EXECUTIVE',
  'GROUP_ADMIN',
  'TENANT_ADMIN',
  'INSTITUTION_ADMIN',
  'SYSTEM_ADMIN',
  'SYSTEM_ADMINISTRATOR',
  'SUPER_ADMIN',
] as const;

describe('PRD role catalog invariants', () => {
  it('canonical list has unique codes', () => {
    expect(new Set(CANONICAL_PRD_ROLES).size).toBe(CANONICAL_PRD_ROLES.length);
  });

  it('forbidden speculative names are not in canonical list', () => {
    for (const code of FORBIDDEN_AS_CANONICAL) {
      expect(CANONICAL_PRD_ROLES).not.toContain(code as never);
    }
  });

  it('self-registerable end-user roles are present', () => {
    expect(CANONICAL_PRD_ROLES).toEqual(
      expect.arrayContaining(['STUDENT', 'PARENT', 'GUARDIAN']),
    );
  });

  it('EXECUTIVE is not a role code', () => {
    expect(CANONICAL_PRD_ROLES.includes('EXECUTIVE' as never)).toBe(false);
  });
});
