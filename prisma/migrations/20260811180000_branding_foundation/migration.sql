CREATE TABLE "theme_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "tokens_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "theme_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branding_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "display_name" VARCHAR(255),
    "short_name" VARCHAR(100),
    "welcome_message" VARCHAR(500),
    "template_code" VARCHAR(50),
    "tokens_json" JSONB NOT NULL,
    "logo_asset_id" UUID,
    "favicon_asset_id" UUID,
    "login_bg_asset_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "branding_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branding_versions" (
    "id" UUID NOT NULL,
    "branding_profile_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "tokens_json" JSONB NOT NULL,
    "summary" VARCHAR(255),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branding_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branding_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "asset_type" VARCHAR(50) NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" VARCHAR(128),
    "original_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "branding_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "theme_templates_code_key" ON "theme_templates"("code");
CREATE INDEX "theme_templates_is_active_sort_order_idx" ON "theme_templates"("is_active", "sort_order");
CREATE UNIQUE INDEX "branding_profiles_institution_id_status_key" ON "branding_profiles"("institution_id", "status");
CREATE INDEX "branding_profiles_tenant_id_institution_id_idx" ON "branding_profiles"("tenant_id", "institution_id");
CREATE UNIQUE INDEX "branding_versions_branding_profile_id_version_key" ON "branding_versions"("branding_profile_id", "version");
CREATE INDEX "branding_versions_branding_profile_id_idx" ON "branding_versions"("branding_profile_id");
CREATE INDEX "branding_assets_tenant_id_institution_id_asset_type_idx" ON "branding_assets"("tenant_id", "institution_id", "asset_type");

ALTER TABLE "branding_profiles" ADD CONSTRAINT "branding_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branding_profiles" ADD CONSTRAINT "branding_profiles_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branding_versions" ADD CONSTRAINT "branding_versions_branding_profile_id_fkey" FOREIGN KEY ("branding_profile_id") REFERENCES "branding_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branding_assets" ADD CONSTRAINT "branding_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "branding_assets" ADD CONSTRAINT "branding_assets_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SYSTEM REFERENCE DATA: theme templates (not dummy business data)
INSERT INTO "theme_templates" ("id", "code", "name", "description", "tokens_json", "is_active", "is_system", "sort_order", "updated_at") VALUES
(gen_random_uuid(), 'EDUCORE_CLASSIC', 'EduCore Classic', 'Default navy professional theme',
 '{"primary":"#0D1B3E","secondary":"#1D4ED8","accent":"#38BDF8","background":"#F1F5F9","foreground":"#0F172A","sidebar":"#0D1B3E","header":"#0D1B3E","buttonPrimary":"#1D4ED8","success":"#047857","warning":"#B45309","error":"#B91C1C","fontFamily":"Inter, system-ui, sans-serif"}'::jsonb,
 true, true, 1, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ACADEMIC_EMERALD', 'Academic Emerald', 'Green academic theme',
 '{"primary":"#064E3B","secondary":"#059669","accent":"#34D399","background":"#ECFDF5","foreground":"#022C22","sidebar":"#064E3B","header":"#065F46","buttonPrimary":"#059669","success":"#047857","warning":"#B45309","error":"#B91C1C","fontFamily":"Inter, system-ui, sans-serif"}'::jsonb,
 true, true, 2, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MODERN_SLATE', 'Modern Slate', 'Neutral modern slate theme',
 '{"primary":"#1E293B","secondary":"#475569","accent":"#94A3B8","background":"#F8FAFC","foreground":"#0F172A","sidebar":"#1E293B","header":"#334155","buttonPrimary":"#475569","success":"#047857","warning":"#B45309","error":"#B91C1C","fontFamily":"Inter, system-ui, sans-serif"}'::jsonb,
 true, true, 3, CURRENT_TIMESTAMP);
