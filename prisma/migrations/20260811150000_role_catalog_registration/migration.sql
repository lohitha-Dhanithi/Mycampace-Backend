-- Role catalog + user_roles + registration_requests
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "registration_mode" VARCHAR(30) NOT NULL,
    "self_registration_allowed" BOOLEAN NOT NULL DEFAULT false,
    "invitation_required" BOOLEAN NOT NULL DEFAULT true,
    "administrator_assignment_required" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_persona_type" VARCHAR(30),
    "tenant_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMPTZ,
    "assigned_by" UUID,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registration_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "requested_role_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_code_tenant_id_key" ON "roles"("code", "tenant_id");
CREATE INDEX "roles_is_active_self_registration_allowed_idx" ON "roles"("is_active", "self_registration_allowed");
CREATE UNIQUE INDEX "user_roles_user_id_role_id_tenant_id_key" ON "user_roles"("user_id", "role_id", "tenant_id");
CREATE INDEX "user_roles_tenant_id_role_id_idx" ON "user_roles"("tenant_id", "role_id");
CREATE INDEX "user_roles_user_id_status_idx" ON "user_roles"("user_id", "status");
CREATE INDEX "registration_requests_tenant_id_email_idx" ON "registration_requests"("tenant_id", "email");
CREATE INDEX "registration_requests_status_idx" ON "registration_requests"("status");

ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_requested_role_id_fkey" FOREIGN KEY ("requested_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- System role catalog (platform-wide, tenant_id NULL)
-- Source: IAM roadmap roles. Portal labels map via display_name only.
-- SELF registration: STUDENT, PARENT only. All others invitation/admin.
INSERT INTO "roles" ("id", "code", "display_name", "description", "registration_mode", "self_registration_allowed", "invitation_required", "administrator_assignment_required", "is_system", "is_active", "default_persona_type", "tenant_id", "updated_at") VALUES
(gen_random_uuid(), 'SUPER_ADMIN', 'Super Administrator', 'Platform super administrator', 'ADMIN_ONLY', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TENANT_ADMIN', 'Institution Administrator', 'Tenant / institution administrator', 'ADMIN_ONLY', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PRINCIPAL', 'Principal', 'Institution principal', 'INVITATION', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'VICE_PRINCIPAL', 'Vice Principal', 'Institution vice principal', 'INVITATION', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'REGISTRAR', 'Registrar', 'Academic registrar', 'INVITATION', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'FACULTY', 'Faculty', 'Teaching faculty', 'INVITATION', false, true, false, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'STUDENT', 'Student', 'Enrolled student', 'SELF', true, false, false, true, true, 'STUDENT', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PARENT', 'Parent / Guardian', 'Parent or guardian', 'SELF', true, false, false, true, true, 'PARENT', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'FINANCE_OFFICER', 'Finance Officer', 'Finance / accounts officer (portal: Accountant)', 'INVITATION', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HR_MANAGER', 'HR Manager', 'Human resources manager', 'INVITATION', false, true, true, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'LIBRARIAN', 'Librarian', 'Library staff', 'INVITATION', false, true, false, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HOSTEL_WARDEN', 'Hostel Warden', 'Hostel administration', 'INVITATION', false, true, false, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TRANSPORT_MANAGER', 'Transport Manager', 'Transport coordination (portal: Transport Coordinator)', 'INVITATION', false, true, false, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PLACEMENT_OFFICER', 'Placement Officer', 'Career placement officer', 'INVITATION', false, true, false, true, true, 'STAFF', NULL, CURRENT_TIMESTAMP);
