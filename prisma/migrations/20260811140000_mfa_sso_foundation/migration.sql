-- CreateEnum
CREATE TYPE "MfaFactorType" AS ENUM ('TOTP', 'SMS', 'EMAIL', 'WEBAUTHN');

-- CreateEnum
CREATE TYPE "MfaFactorStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED', 'REVOKED');

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "MfaFactorType" NOT NULL,
    "status" "MfaFactorStatus" NOT NULL DEFAULT 'PENDING',
    "display_name" VARCHAR(100),
    "encrypted_secret" TEXT,
    "verified_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "disabled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_providers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "issuer" VARCHAR(512),
    "client_id" VARCHAR(255),
    "secret_ref" VARCHAR(255),
    "metadata_url" VARCHAR(1024),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mfa_factors_user_id_tenant_id_status_idx" ON "mfa_factors"("user_id", "tenant_id", "status");
CREATE INDEX "mfa_factors_user_id_type_idx" ON "mfa_factors"("user_id", "type");
CREATE UNIQUE INDEX "external_identities_tenant_id_provider_provider_subject_key" ON "external_identities"("tenant_id", "provider", "provider_subject");
CREATE INDEX "external_identities_user_id_idx" ON "external_identities"("user_id");
CREATE INDEX "external_identities_email_idx" ON "external_identities"("email");
CREATE UNIQUE INDEX "identity_providers_tenant_id_provider_key" ON "identity_providers"("tenant_id", "provider");
CREATE INDEX "identity_providers_tenant_id_enabled_idx" ON "identity_providers"("tenant_id", "enabled");

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
