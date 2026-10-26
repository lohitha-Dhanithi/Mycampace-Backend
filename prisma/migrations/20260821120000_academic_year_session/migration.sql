-- Sprint 2: Academic Year & Session foundation

CREATE TYPE "AcademicYearStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "academic_years" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'INACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_years_tenant_id_institution_id_code_key" ON "academic_years"("tenant_id", "institution_id", "code");
CREATE INDEX "academic_years_tenant_id_institution_id_status_idx" ON "academic_years"("tenant_id", "institution_id", "status");
CREATE INDEX "academic_years_tenant_id_status_idx" ON "academic_years"("tenant_id", "status");

ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
VALUES
  (gen_random_uuid(), 'academic.year.read', 'View academic years', 'View academic years and sessions', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'academic.year.manage', 'Manage academic years', 'Create, update, and activate academic years', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN ('academic.year.read', 'academic.year.manage')
WHERE r.code IN ('PRINCIPAL', 'VICE_PRINCIPAL', 'REGISTRAR', 'ACADEMIC_DIRECTOR', 'DEAN', 'FOUNDER', 'CEO', 'MANAGING_DIRECTOR')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code = 'academic.year.read'
WHERE r.code IN ('FACULTY', 'HEAD_OF_DEPARTMENT', 'PROFESSOR', 'SCHOOL_TEACHER')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;
