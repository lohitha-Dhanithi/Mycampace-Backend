CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_module_is_active_idx" ON "permissions"("module", "is_active");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permission catalog: identity + platform foundation (roadmap-ready institution/admission marked)
INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at") VALUES
(gen_random_uuid(), 'identity.user.read', 'View users', 'View user identity within tenant', 'identity', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'identity.user.manage', 'Manage users', 'Create/update user lifecycle within tenant', 'identity', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'identity.role.read', 'View roles', 'View role catalog', 'identity', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'identity.permission.read', 'View permissions', 'View permission catalog', 'identity', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'identity.role.assign', 'Assign roles', 'Assign/revoke roles within tenant', 'identity', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'registration.approve', 'Approve registration', 'Approve pending registration requests', 'identity', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'tenant.read', 'View tenant', 'View own tenant configuration', 'tenant', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'tenant.manage', 'Manage tenant', 'Manage tenant settings', 'tenant', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'institution.read', 'View institution', 'View institution profile', 'institution', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'institution.manage', 'Manage institution', 'Manage institution settings', 'institution', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'admission.read', 'View admissions', 'View admission applications', 'admissions', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'admission.manage', 'Manage admissions', 'Process admission applications', 'admissions', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'student.read', 'View students', 'View student records', 'student', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'student.manage', 'Manage students', 'Manage student records', 'student', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'branding.manage', 'Manage branding', 'Manage tenant branding/white-label', 'branding', 'MANAGE', true, true, CURRENT_TIMESTAMP);

-- Role → Permission mappings (conservative; only clear role responsibilities)
-- SUPER_ADMIN: platform authority over identity/tenant catalog
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'SUPER_ADMIN' AND r.tenant_id IS NULL;

-- TENANT_ADMIN: all operational permissions within tenant scope
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r CROSS JOIN "permissions" p
WHERE r.code = 'TENANT_ADMIN' AND r.tenant_id IS NULL;

-- PRINCIPAL
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'institution.read','admission.read','admission.manage','student.read','student.manage','identity.user.read','registration.approve'
) WHERE r.code = 'PRINCIPAL' AND r.tenant_id IS NULL;

-- VICE_PRINCIPAL
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'institution.read','admission.read','student.read','identity.user.read'
) WHERE r.code = 'VICE_PRINCIPAL' AND r.tenant_id IS NULL;

-- REGISTRAR
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'admission.read','admission.manage','student.read','student.manage','registration.approve','identity.user.read'
) WHERE r.code = 'REGISTRAR' AND r.tenant_id IS NULL;

-- FACULTY
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'student.read','institution.read'
) WHERE r.code = 'FACULTY' AND r.tenant_id IS NULL;

-- STUDENT / PARENT — minimal self scope reads (institution profile)
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'institution.read'
) WHERE r.code IN ('STUDENT','PARENT') AND r.tenant_id IS NULL;

-- FINANCE_OFFICER — admissions read only until finance module permissions defined
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'student.read','institution.read'
) WHERE r.code = 'FINANCE_OFFICER' AND r.tenant_id IS NULL;

-- HR_MANAGER
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'identity.user.read','institution.read'
) WHERE r.code = 'HR_MANAGER' AND r.tenant_id IS NULL;

-- LIBRARIAN / HOSTEL_WARDEN / TRANSPORT_MANAGER / PLACEMENT_OFFICER — institution.read only until domain PRD expands
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r JOIN "permissions" p ON p.code IN (
  'institution.read'
) WHERE r.code IN ('LIBRARIAN','HOSTEL_WARDEN','TRANSPORT_MANAGER','PLACEMENT_OFFICER') AND r.tenant_id IS NULL;
