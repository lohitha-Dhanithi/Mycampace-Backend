CREATE TYPE "AdmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "admission_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "application_no" VARCHAR(50) NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "date_of_birth" DATE,
    "program_applied" VARCHAR(150),
    "academic_year" VARCHAR(20),
    "notes" VARCHAR(1000),
    "submitted_at" TIMESTAMPTZ,
    "reviewed_at" TIMESTAMPTZ,
    "decided_at" TIMESTAMPTZ,
    "decided_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admission_applications_tenant_id_application_no_key" ON "admission_applications"("tenant_id", "application_no");
CREATE INDEX "admission_applications_tenant_id_institution_id_status_idx" ON "admission_applications"("tenant_id", "institution_id", "status");
CREATE INDEX "admission_applications_tenant_id_email_idx" ON "admission_applications"("tenant_id", "email");
CREATE INDEX "admission_applications_institution_id_status_idx" ON "admission_applications"("institution_id", "status");

ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
