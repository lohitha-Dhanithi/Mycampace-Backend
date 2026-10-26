-- =============================================================================
-- PRD Role Catalog Alignment (AI Chrona Master PRD Ch.3)
-- - Seeds canonical PRD roles
-- - Deprecates non-PRD speculative roles (does not hard-delete for data safety)
-- - Does NOT invent GROUP_ADMIN / TENANT_ADMIN / EXECUTIVE / SUPER_ADMIN as PRD roles
-- =============================================================================

-- 1) Deprecate non-canonical / speculative roles (keep rows for FK history)
UPDATE "roles"
SET
  "is_active" = false,
  "self_registration_allowed" = false,
  "invitation_required" = true,
  "administrator_assignment_required" = true,
  "registration_mode" = 'ADMIN_ONLY',
  "description" = COALESCE("description", '') || ' [DEPRECATED — not a canonical PRD Chapter 3 role]',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "tenant_id" IS NULL
  AND "code" IN (
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'FACULTY',
    'FINANCE_OFFICER',
    'PLACEMENT_OFFICER'
  );

-- 2) Insert canonical PRD roles (platform catalog: tenant_id IS NULL)
-- registration_mode: SELF | INVITATION | ADMIN_ONLY
-- Leadership / privileged staff: ADMIN_ONLY or INVITATION — never public self-grant

INSERT INTO "roles" (
  "id", "code", "display_name", "description", "registration_mode",
  "self_registration_allowed", "invitation_required", "administrator_assignment_required",
  "is_system", "is_active", "default_persona_type", "tenant_id", "updated_at"
)
SELECT gen_random_uuid(), v.code, v.display_name, v.description, v.registration_mode,
       v.self_registration_allowed, v.invitation_required, v.administrator_assignment_required,
       true, true, v.default_persona_type, NULL, CURRENT_TIMESTAMP
FROM (
  VALUES
  -- Institutional Leadership
  ('FOUNDER', 'Founder', 'Institutional founder — strategic oversight', 'ADMIN_ONLY', false, true, true, 'STAFF'),
  ('CHAIRMAN', 'Chairman', 'Board chairman — strategic monitoring', 'ADMIN_ONLY', false, true, true, 'STAFF'),
  ('TRUSTEE', 'Trustee', 'Board trustee — governance', 'ADMIN_ONLY', false, true, true, 'STAFF'),
  ('BOARD_MEMBER', 'Board Member', 'Board member — governance', 'ADMIN_ONLY', false, true, true, 'STAFF'),
  ('MANAGING_DIRECTOR', 'Managing Director', 'Managing director — executive operations', 'ADMIN_ONLY', false, true, true, 'STAFF'),
  ('CEO', 'CEO', 'Chief executive officer', 'ADMIN_ONLY', false, true, true, 'STAFF'),
  -- Academic Leadership
  ('PRINCIPAL', 'Principal', 'Campus principal', 'INVITATION', false, true, true, 'STAFF'),
  ('VICE_PRINCIPAL', 'Vice Principal', 'Campus vice principal', 'INVITATION', false, true, true, 'STAFF'),
  ('DEAN', 'Dean', 'Academic unit dean', 'INVITATION', false, true, true, 'STAFF'),
  ('REGISTRAR', 'Registrar', 'Academic registrar', 'INVITATION', false, true, true, 'STAFF'),
  ('ACADEMIC_DIRECTOR', 'Academic Director', 'Academic director', 'INVITATION', false, true, true, 'STAFF'),
  ('EXAMINATION_CONTROLLER', 'Examination Controller', 'Examination controller', 'INVITATION', false, true, true, 'STAFF'),
  -- Administrative Staff
  ('ADMISSION_MANAGER', 'Admission Manager', 'Admissions operations manager', 'INVITATION', false, true, true, 'STAFF'),
  ('COUNSELLOR', 'Counsellor', 'Admission counsellor', 'INVITATION', false, true, false, 'STAFF'),
  ('RECEPTIONIST', 'Receptionist', 'Front desk receptionist', 'INVITATION', false, true, false, 'STAFF'),
  ('FINANCE_MANAGER', 'Finance Manager', 'Finance manager', 'INVITATION', false, true, true, 'STAFF'),
  ('ACCOUNTANT', 'Accountant', 'Accountant', 'INVITATION', false, true, true, 'STAFF'),
  ('HR_MANAGER', 'HR Manager', 'Human resources manager', 'INVITATION', false, true, true, 'STAFF'),
  ('PAYROLL_OFFICER', 'Payroll Officer', 'Payroll officer', 'INVITATION', false, true, true, 'STAFF'),
  ('PROCUREMENT_OFFICER', 'Procurement Officer', 'Procurement officer', 'INVITATION', false, true, true, 'STAFF'),
  ('INVENTORY_MANAGER', 'Inventory Manager', 'Inventory manager', 'INVITATION', false, true, true, 'STAFF'),
  -- Faculty
  ('HEAD_OF_DEPARTMENT', 'Head of Department', 'Department head', 'INVITATION', false, true, true, 'STAFF'),
  ('PROFESSOR', 'Professor', 'Professor', 'INVITATION', false, true, false, 'STAFF'),
  ('ASSOCIATE_PROFESSOR', 'Associate Professor', 'Associate professor', 'INVITATION', false, true, false, 'STAFF'),
  ('ASSISTANT_PROFESSOR', 'Assistant Professor', 'Assistant professor', 'INVITATION', false, true, false, 'STAFF'),
  ('SCHOOL_TEACHER', 'School Teacher', 'School teacher', 'INVITATION', false, true, false, 'STAFF'),
  ('VISITING_FACULTY', 'Visiting Faculty', 'Visiting faculty', 'INVITATION', false, true, false, 'STAFF'),
  ('GUEST_FACULTY', 'Guest Faculty', 'Guest faculty', 'INVITATION', false, true, false, 'STAFF'),
  ('CONTRACT_TEACHER', 'Contract Teacher', 'Contract teacher', 'INVITATION', false, true, false, 'STAFF'),
  ('LAB_INSTRUCTOR', 'Lab Instructor', 'Laboratory instructor', 'INVITATION', false, true, false, 'STAFF'),
  -- Operational Staff
  ('HOSTEL_WARDEN', 'Hostel Warden', 'Hostel warden', 'INVITATION', false, true, false, 'STAFF'),
  ('LIBRARIAN', 'Librarian', 'Librarian', 'INVITATION', false, true, false, 'STAFF'),
  ('TRANSPORT_MANAGER', 'Transport Manager', 'Transport manager', 'INVITATION', false, true, false, 'STAFF'),
  ('DRIVER', 'Driver', 'Transport driver', 'INVITATION', false, true, false, 'STAFF'),
  ('SECURITY_STAFF', 'Security Staff', 'Security staff', 'INVITATION', false, true, false, 'STAFF'),
  ('MAINTENANCE_STAFF', 'Maintenance Staff', 'Maintenance staff', 'INVITATION', false, true, false, 'STAFF'),
  -- End Users
  ('STUDENT', 'Student', 'Student', 'SELF', true, false, false, 'STUDENT'),
  ('PARENT', 'Parent', 'Parent', 'SELF', true, false, false, 'PARENT'),
  ('GUARDIAN', 'Guardian', 'Guardian', 'SELF', true, false, false, 'PARENT'),
  ('ALUMNI', 'Alumni', 'Alumni', 'INVITATION', false, true, false, 'EXTERNAL'),
  -- External Users
  ('VENDOR', 'Vendor', 'External vendor', 'INVITATION', false, true, true, 'EXTERNAL'),
  ('FINANCE_PARTNER', 'Finance Partner', 'External finance partner', 'INVITATION', false, true, true, 'EXTERNAL'),
  ('RECRUITER', 'Recruiter', 'External recruiter', 'INVITATION', false, true, true, 'EXTERNAL'),
  ('ACCREDITATION_AUDITOR', 'Accreditation Auditor', 'External accreditation auditor', 'INVITATION', false, true, true, 'EXTERNAL'),
  ('GOVERNMENT_OFFICER', 'Government Officer', 'External government officer', 'INVITATION', false, true, true, 'EXTERNAL')
) AS v(
  code, display_name, description, registration_mode,
  self_registration_allowed, invitation_required, administrator_assignment_required,
  default_persona_type
)
WHERE NOT EXISTS (
  SELECT 1 FROM "roles" r WHERE r.code = v.code AND r.tenant_id IS NULL
);

-- 3) Ensure existing PRD-overlapping roles that already existed stay active and metadata-aligned
UPDATE "roles"
SET
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "tenant_id" IS NULL
  AND "code" IN (
    'PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','STUDENT','PARENT',
    'HR_MANAGER','LIBRARIAN','HOSTEL_WARDEN','TRANSPORT_MANAGER'
  );

-- Align STUDENT / PARENT / GUARDIAN self-registration flags
UPDATE "roles"
SET
  "registration_mode" = 'SELF',
  "self_registration_allowed" = true,
  "invitation_required" = false,
  "administrator_assignment_required" = false,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "tenant_id" IS NULL AND "code" IN ('STUDENT','PARENT','GUARDIAN');

-- 4) Foundation permission: dashboard.executive.read (leadership dashboards — NOT an EXECUTIVE role)
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'dashboard.executive.read', 'View executive dashboard',
       'Access executive/group management dashboard aggregates', 'dashboard', 'READ', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'dashboard.executive.read');

-- Ensure admission.self / parent.portal.read exist (idempotent)
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'admission.self', 'Own admission application',
       'View and update own student admission application', 'admissions', 'SELF', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'admission.self');

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'parent.portal.read', 'Parent portal access',
       'View linked students and their admission applications', 'parent', 'READ', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'parent.portal.read');

-- 5) Map foundation permissions to PRD leadership roles (executive dashboard)
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL
  AND r.code IN ('FOUNDER','CHAIRMAN','TRUSTEE','BOARD_MEMBER','MANAGING_DIRECTOR','CEO')
  AND p.code IN ('dashboard.executive.read','institution.read','admission.read','identity.user.read')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Principal: campus-oriented — institution + admissions + dashboard (campus filter is ABAC future)
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL
  AND r.code IN ('PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','DEAN','ACADEMIC_DIRECTOR')
  AND p.code IN ('dashboard.executive.read','institution.read','admission.read','admission.manage','identity.user.read')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Admissions staff
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL
  AND r.code IN ('ADMISSION_MANAGER','COUNSELLOR')
  AND p.code IN ('admission.read','admission.manage','institution.read','identity.user.read')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Faculty family — read-oriented foundation only until academic module
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL
  AND r.code IN (
    'HEAD_OF_DEPARTMENT','PROFESSOR','ASSOCIATE_PROFESSOR','ASSISTANT_PROFESSOR',
    'SCHOOL_TEACHER','VISITING_FACULTY','GUEST_FACULTY','CONTRACT_TEACHER','LAB_INSTRUCTOR'
  )
  AND p.code IN ('institution.read','student.read')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- STUDENT / PARENT / GUARDIAN
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL AND r.code = 'STUDENT'
  AND p.code IN ('institution.read','admission.self')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL AND r.code IN ('PARENT','GUARDIAN')
  AND p.code IN ('institution.read','parent.portal.read')
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Ops roles with institution.read until domain modules
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL
  AND r.code IN ('HOSTEL_WARDEN','LIBRARIAN','TRANSPORT_MANAGER','DRIVER','SECURITY_STAFF','MAINTENANCE_STAFF',
                 'RECEPTIONIST','HR_MANAGER','FINANCE_MANAGER','ACCOUNTANT','PAYROLL_OFFICER',
                 'PROCUREMENT_OFFICER','INVENTORY_MANAGER','EXAMINATION_CONTROLLER')
  AND p.code = 'institution.read'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
