-- HRMS permission catalog
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
VALUES
(gen_random_uuid(), 'hrms.dashboard.read', 'View HR dashboard', 'Headcount, leave queue, appraisal and compliance summary', 'hrms', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.setup.read', 'View HR setup', 'View categories, departments, leave types and appraisal metrics', 'hrms', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.setup.manage', 'Manage HR setup', 'Manage categories, departments, leave types and appraisal metrics', 'hrms', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.staff.read', 'View staff records', 'Staff directory and employee profiles, including documents', 'hrms', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.staff.manage', 'Manage staff records', 'Create/update staff, documents, service events and certifications', 'hrms', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.leave.read', 'View all leave requests', 'Leave desk across the organisation', 'hrms', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.leave.manage', 'Manage leave (HR)', 'Create leave on behalf of staff and take the final HR decision', 'hrms', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.attendance.read', 'View attendance', 'View shifts and attendance registers', 'hrms', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.attendance.manage', 'Manage attendance', 'Manage shifts and mark attendance', 'hrms', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.appraisal.read', 'View appraisals', 'View all appraisal cycles and reviews', 'hrms', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.appraisal.manage', 'Manage appraisals', 'Create cycles; act as HOD reviewer where needed', 'hrms', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.appraisal.principal', 'Principal appraisal review', 'Complete the Principal review stage', 'hrms', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'hrms.self', 'HRMS self-service', 'My Portal: own profile, leave, attendance, appraisal; manager approvals assigned to me', 'hrms', 'SELF', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- HR Manager: everything except the Principal review stage
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'HR_MANAGER' AND p.code LIKE 'hrms.%' AND p.code <> 'hrms.appraisal.principal'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Principal: oversight (read) plus the Principal review stage
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'PRINCIPAL'
  AND p.code IN ('hrms.dashboard.read','hrms.staff.read','hrms.leave.read','hrms.attendance.read',
                 'hrms.appraisal.read','hrms.appraisal.principal','hrms.self')
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Leadership: read-only oversight
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code IN ('FOUNDER','CHAIRMAN','MANAGING_DIRECTOR','CEO')
  AND p.code IN ('hrms.dashboard.read','hrms.staff.read','hrms.leave.read','hrms.attendance.read','hrms.appraisal.read')
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Self-service for staff personas (own record, approvals assigned to them, own appraisal stages)
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code IN ('STAFF','SCHOOL_TEACHER','CONTRACT_TEACHER','PROFESSOR','ASSOCIATE_PROFESSOR','ASSISTANT_PROFESSOR',
                 'HEAD_OF_DEPARTMENT','FACULTY','GUEST_FACULTY','VISITING_FACULTY','LAB_INSTRUCTOR','VICE_PRINCIPAL',
                 'DEAN','REGISTRAR','ACADEMIC_DIRECTOR','ACCOUNTANT','LIBRARIAN','RECEPTIONIST','COUNSELLOR')
  AND p.code = 'hrms.self'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
