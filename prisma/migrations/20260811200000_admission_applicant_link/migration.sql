-- Link applications to authenticated applicant for portal ownership
ALTER TABLE "admission_applications" ADD COLUMN "applicant_user_id" UUID;

CREATE INDEX "admission_applications_applicant_user_id_tenant_id_idx" ON "admission_applications"("applicant_user_id", "tenant_id");

ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permission for applicants to manage own applications (not CRM)
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at")
SELECT gen_random_uuid(), 'admission.self', 'Own admission application', 'View and update own student admission application', 'admissions', 'SELF', true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'admission.self');

-- Grant admission.self to STUDENT role
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'STUDENT' AND r.tenant_id IS NULL AND p.code = 'admission.self'
ON CONFLICT DO NOTHING;
