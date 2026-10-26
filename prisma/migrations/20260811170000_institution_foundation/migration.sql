CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "institution_type" VARCHAR(50),
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "website" VARCHAR(255),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(100),
    "timezone" VARCHAR(50),
    "locale" VARCHAR(20),
    "currency" VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutions_tenant_id_institution_code_key" ON "institutions"("tenant_id", "institution_code");
CREATE INDEX "institutions_tenant_id_status_idx" ON "institutions"("tenant_id", "status");
CREATE INDEX "institutions_tenant_id_idx" ON "institutions"("tenant_id");

ALTER TABLE "institutions" ADD CONSTRAINT "institutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
