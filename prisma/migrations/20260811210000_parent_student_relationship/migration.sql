CREATE TABLE "parent_student_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_user_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "institution_id" UUID,
    "relationship_type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "parent_student_relationships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_student_relationships_tenant_id_parent_user_id_student_user_id_key"
  ON "parent_student_relationships"("tenant_id", "parent_user_id", "student_user_id");
CREATE INDEX "parent_student_relationships_tenant_id_parent_user_id_status_idx"
  ON "parent_student_relationships"("tenant_id", "parent_user_id", "status");
CREATE INDEX "parent_student_relationships_tenant_id_student_user_id_status_idx"
  ON "parent_student_relationships"("tenant_id", "student_user_id", "status");

ALTER TABLE "parent_student_relationships" ADD CONSTRAINT "parent_student_relationships_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parent_student_relationships" ADD CONSTRAINT "parent_student_relationships_parent_user_id_fkey"
  FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_student_relationships" ADD CONSTRAINT "parent_student_relationships_student_user_id_fkey"
  FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parent_student_relationships" ADD CONSTRAINT "parent_student_relationships_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'parent.portal.read', 'Parent portal access', 'View linked students and their admission applications', 'parent', 'READ', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'parent.portal.read');

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'PARENT' AND r.tenant_id IS NULL AND p.code = 'parent.portal.read'
ON CONFLICT DO NOTHING;
