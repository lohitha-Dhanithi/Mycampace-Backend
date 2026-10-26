-- Sprint 2 Academic/SIS permission catalog
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
VALUES
(gen_random_uuid(), 'academic.year.read', 'View academic years', 'List and view academic years', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.year.manage', 'Manage academic years', 'Create/update academic years', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.department.read', 'View departments', 'List academic departments', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.department.manage', 'Manage departments', 'Create/update departments', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.program.read', 'View programs', 'List programs', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.program.manage', 'Manage programs', 'Create/update programs', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.course.read', 'View courses', 'List courses', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.course.manage', 'Manage courses', 'Create/update courses', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.subject.read', 'View subjects', 'List subjects', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.subject.manage', 'Manage subjects', 'Create/update subjects', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.curriculum.read', 'View curriculum', 'View curriculum config', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.curriculum.manage', 'Manage curriculum', 'Configure curriculum', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.semester.read', 'View semesters', 'List semesters/terms', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.semester.manage', 'Manage semesters', 'Create/update semesters', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.calendar.read', 'View academic calendar', 'View calendar events', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.calendar.manage', 'Manage academic calendar', 'Manage calendar events', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.student.read', 'View students', 'List student records (SIS)', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.student.manage', 'Manage students', 'Create/update/allocate students', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.batch.read', 'View batches', 'List batches', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.batch.manage', 'Manage batches', 'Create/update batches', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.class.read', 'View classes/sections', 'List classes and sections', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.class.manage', 'Manage classes/sections', 'Create/update classes and sections', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.promotion.manage', 'Promote/transfer students', 'Student promotion and transfer', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.faculty.read', 'View faculty', 'List faculty masters', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.faculty.manage', 'Manage faculty', 'Create/update faculty and allocations', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.resource.read', 'View academic resources', 'View buildings/rooms/labs', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.resource.manage', 'Manage academic resources', 'Manage buildings/rooms/labs', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.schedule.read', 'View schedule config', 'View periods and time slots', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.schedule.manage', 'Manage schedule config', 'Manage periods and time slots', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Map new academic permissions to leadership roles
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('FOUNDER','CHAIRMAN','MANAGING_DIRECTOR','CEO','PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','ACADEMIC_DIRECTOR','DEAN')
  AND p.code LIKE 'academic.%'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Faculty roles: read-heavy
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('HEAD_OF_DEPARTMENT','PROFESSOR','ASSOCIATE_PROFESSOR','ASSISTANT_PROFESSOR','SCHOOL_TEACHER')
  AND p.code IN (
    'academic.year.read','academic.department.read','academic.program.read','academic.course.read',
    'academic.subject.read','academic.student.read','academic.class.read','academic.batch.read',
    'academic.faculty.read','academic.schedule.read','academic.calendar.read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
