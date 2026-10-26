CREATE TYPE "CampusStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "campuses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "CampusStatus" NOT NULL DEFAULT 'ACTIVE',
    "address_line1" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campuses_tenant_id_institution_id_code_key" ON "campuses"("tenant_id", "institution_id", "code");
CREATE INDEX "campuses_tenant_id_status_idx" ON "campuses"("tenant_id", "status");
CREATE INDEX "campuses_institution_id_status_idx" ON "campuses"("institution_id", "status");

ALTER TABLE "campuses" ADD CONSTRAINT "campuses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(80),
    "result" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "correlation_id" VARCHAR(80),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_tenant_id_module_action_idx" ON "audit_logs"("tenant_id", "module", "action");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional permission for campus management (foundation)
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'campus.read', 'View campuses', 'View campus records within tenant', 'campus', 'READ', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'campus.read');

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'campus.manage', 'Manage campuses', 'Create/update/archive campuses', 'campus', 'MANAGE', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'campus.manage');

-- Leadership + principal/registrar get campus permissions
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL
  AND r.is_active = true
  AND r.code IN ('FOUNDER','CHAIRMAN','CEO','MANAGING_DIRECTOR','PRINCIPAL','VICE_PRINCIPAL','REGISTRAR')
  AND p.code IN ('campus.read','campus.manage')
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL AND r.is_active = true
  AND r.code IN ('TRUSTEE','BOARD_MEMBER','DEAN','ACADEMIC_DIRECTOR','ADMISSION_MANAGER')
  AND p.code = 'campus.read'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
