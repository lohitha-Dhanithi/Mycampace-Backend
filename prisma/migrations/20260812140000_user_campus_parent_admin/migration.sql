CREATE TABLE "user_campus_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "user_campus_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_campus_assignments_tenant_id_user_id_campus_id_key"
  ON "user_campus_assignments"("tenant_id", "user_id", "campus_id");
CREATE INDEX "user_campus_assignments_tenant_id_user_id_status_idx"
  ON "user_campus_assignments"("tenant_id", "user_id", "status");
CREATE INDEX "user_campus_assignments_campus_id_status_idx"
  ON "user_campus_assignments"("campus_id", "status");

ALTER TABLE "user_campus_assignments" ADD CONSTRAINT "user_campus_assignments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_campus_assignments" ADD CONSTRAINT "user_campus_assignments_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_campus_assignments" ADD CONSTRAINT "user_campus_assignments_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_campus_assignments" ADD CONSTRAINT "user_campus_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Parent relationship admin permission
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'parent.relationship.manage', 'Manage parent-student links',
       'Create, activate, revoke parent/guardian to student relationships', 'parent', 'MANAGE', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'parent.relationship.manage');

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'campus.assign', 'Assign users to campuses',
       'Create/revoke user campus assignments', 'campus', 'ASSIGN', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'campus.assign');

-- Grant relationship manage to registrar/admission manager/principal leadership
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL AND r.is_active = true
  AND r.code IN ('PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','ADMISSION_MANAGER','FOUNDER','CHAIRMAN','CEO','MANAGING_DIRECTOR')
  AND p.code = 'parent.relationship.manage'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.tenant_id IS NULL AND r.is_active = true
  AND r.code IN ('PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','FOUNDER','CHAIRMAN','CEO','MANAGING_DIRECTOR')
  AND p.code = 'campus.assign'
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
