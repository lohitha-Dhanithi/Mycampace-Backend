CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CourseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "SubjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "status" "ProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "programs_tenant_id_institution_id_code_key" ON "programs"("tenant_id", "institution_id", "code");
CREATE INDEX "programs_tenant_id_department_id_status_idx" ON "programs"("tenant_id", "department_id", "status");
CREATE INDEX "programs_tenant_id_institution_id_status_idx" ON "programs"("tenant_id", "institution_id", "status");
ALTER TABLE "programs" ADD CONSTRAINT "programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programs" ADD CONSTRAINT "programs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "credits" INTEGER,
    "status" "CourseStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "courses_tenant_id_program_id_code_key" ON "courses"("tenant_id", "program_id", "code");
CREATE INDEX "courses_tenant_id_program_id_status_idx" ON "courses"("tenant_id", "program_id", "status");
CREATE INDEX "courses_tenant_id_institution_id_status_idx" ON "courses"("tenant_id", "institution_id", "status");
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "SubjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subjects_tenant_id_course_id_code_key" ON "subjects"("tenant_id", "course_id", "code");
CREATE INDEX "subjects_tenant_id_course_id_status_idx" ON "subjects"("tenant_id", "course_id", "status");
CREATE INDEX "subjects_tenant_id_institution_id_status_idx" ON "subjects"("tenant_id", "institution_id", "status");
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at") VALUES
(gen_random_uuid(), 'academic.program.read', 'View programs', 'View academic programs', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.program.manage', 'Manage programs', 'Create, update, archive programs', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.course.read', 'View courses', 'View courses under programs', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.course.manage', 'Manage courses', 'Create, update, archive courses', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.subject.read', 'View subjects', 'View subjects under courses', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.subject.manage', 'Manage subjects', 'Create, update, archive subjects', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'academic.program.read','academic.program.manage',
  'academic.course.read','academic.course.manage',
  'academic.subject.read','academic.subject.manage'
)
WHERE r.code IN ('PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','ACADEMIC_DIRECTOR','DEAN','FOUNDER','CEO','MANAGING_DIRECTOR')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'academic.program.read','academic.course.read','academic.subject.read'
)
WHERE r.code IN ('FACULTY','HEAD_OF_DEPARTMENT','PROFESSOR','SCHOOL_TEACHER')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;
