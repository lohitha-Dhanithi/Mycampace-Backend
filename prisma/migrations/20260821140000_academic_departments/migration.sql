-- Sprint 2: Academic Departments

CREATE TYPE "DepartmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_tenant_id_institution_id_code_key" ON "departments"("tenant_id", "institution_id", "code");
CREATE INDEX "departments_tenant_id_institution_id_status_idx" ON "departments"("tenant_id", "institution_id", "status");
CREATE INDEX "departments_tenant_id_status_idx" ON "departments"("tenant_id", "status");

ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
VALUES
  (gen_random_uuid(), 'academic.department.read', 'View departments', 'View academic departments', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'academic.department.manage', 'Manage departments', 'Create, update, and archive academic departments', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN ('academic.department.read', 'academic.department.manage')
WHERE r.code IN ('PRINCIPAL', 'VICE_PRINCIPAL', 'REGISTRAR', 'ACADEMIC_DIRECTOR', 'DEAN', 'FOUNDER', 'CEO', 'MANAGING_DIRECTOR')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code = 'academic.department.read'
WHERE r.code IN ('FACULTY', 'HEAD_OF_DEPARTMENT', 'PROFESSOR', 'SCHOOL_TEACHER')
  AND r.tenant_id IS NULL
ON CONFLICT DO NOTHING;
