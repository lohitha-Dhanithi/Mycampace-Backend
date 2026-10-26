-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'PROBATION', 'SEPARATED');

-- CreateEnum
CREATE TYPE "HrmsLookupStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffDocumentStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveApproverKind" AS ENUM ('APPLICANT', 'MANAGER', 'HR');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "AppraisalStage" AS ENUM ('SELF_REVIEW', 'HOD_REVIEW', 'PRINCIPAL_REVIEW', 'HR_CLOSED');

-- CreateEnum
CREATE TYPE "AppraisalRating" AS ENUM ('OUTSTANDING', 'EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT');

-- CreateTable
CREATE TABLE "hrms_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_teaching" BOOLEAN NOT NULL DEFAULT false,
    "status" "HrmsLookupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "hrms_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hrms_departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "academic_department_id" UUID,
    "head_staff_id" UUID,
    "status" "HrmsLookupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "hrms_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_code" VARCHAR(30) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "category_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "designation" VARCHAR(150) NOT NULL,
    "reporting_manager_id" UUID,
    "joining_date" DATE NOT NULL,
    "separation_date" DATE,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "qualification" VARCHAR(255),
    "experience_years" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500),
    "mime_type" VARCHAR(100),
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" UUID,
    "expiry_date" DATE,
    "status" "StaffDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "staff_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "detail" VARCHAR(1000),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(200),
    "issued_on" DATE,
    "valid_until" DATE,
    "status" "CertificationStatus" NOT NULL DEFAULT 'VALID',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "default_entitlement" DECIMAL(5,1),
    "deducts_balance" BOOLEAN NOT NULL DEFAULT true,
    "status" "HrmsLookupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "entitled" DECIMAL(5,1) NOT NULL,
    "used" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "days" DECIMAL(5,1) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING_MANAGER',
    "current_approver_id" UUID,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ,
    "balance_deducted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leave_request_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "approver_kind" "LeaveApproverKind" NOT NULL,
    "actor_staff_id" UUID,
    "actor_user_id" UUID,
    "actor_name" VARCHAR(200) NOT NULL,
    "decision" "LeaveDecision" NOT NULL,
    "comment" VARCHAR(1000),
    "acted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "status" "HrmsLookupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "shift_id" UUID,
    "attendance_date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "check_in_at" TIMESTAMPTZ,
    "check_out_at" TIMESTAMPTZ,
    "leave_request_id" UUID,
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "remarks" VARCHAR(500),
    "marked_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_cycles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appraisal_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_metric_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "weight" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appraisal_metric_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "stage" "AppraisalStage" NOT NULL DEFAULT 'SELF_REVIEW',
    "self_score" DECIMAL(3,1),
    "hod_score" DECIMAL(3,1),
    "principal_score" DECIMAL(3,1),
    "final_score" DECIMAL(3,1),
    "final_rating" "AppraisalRating",
    "closed_at" TIMESTAMPTZ,
    "closed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appraisal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_review_metrics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "weight" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "self_score" SMALLINT,
    "hod_score" SMALLINT,
    "principal_score" SMALLINT,

    CONSTRAINT "appraisal_review_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "stage" "AppraisalStage" NOT NULL,
    "author_user_id" UUID,
    "comment" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hrms_categories_tenant_id_status_idx" ON "hrms_categories"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hrms_categories_tenant_id_name_key" ON "hrms_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "hrms_departments_tenant_id_status_idx" ON "hrms_departments"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hrms_departments_tenant_id_name_key" ON "hrms_departments"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "staff_tenant_id_status_idx" ON "staff"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "staff_tenant_id_campus_id_status_idx" ON "staff"("tenant_id", "campus_id", "status");

-- CreateIndex
CREATE INDEX "staff_tenant_id_department_id_idx" ON "staff"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "staff_tenant_id_category_id_idx" ON "staff"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "staff_reporting_manager_id_idx" ON "staff"("reporting_manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tenant_id_employee_code_key" ON "staff"("tenant_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tenant_id_email_key" ON "staff"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_tenant_id_user_id_key" ON "staff"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "staff_documents_tenant_id_staff_id_idx" ON "staff_documents"("tenant_id", "staff_id");

-- CreateIndex
CREATE INDEX "staff_documents_tenant_id_status_idx" ON "staff_documents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "staff_documents_tenant_id_expiry_date_idx" ON "staff_documents"("tenant_id", "expiry_date");

-- CreateIndex
CREATE INDEX "service_events_tenant_id_staff_id_event_date_idx" ON "service_events"("tenant_id", "staff_id", "event_date");

-- CreateIndex
CREATE INDEX "certifications_tenant_id_staff_id_idx" ON "certifications"("tenant_id", "staff_id");

-- CreateIndex
CREATE INDEX "certifications_tenant_id_valid_until_idx" ON "certifications"("tenant_id", "valid_until");

-- CreateIndex
CREATE INDEX "leave_types_tenant_id_status_idx" ON "leave_types"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_tenant_id_code_key" ON "leave_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "leave_balances_tenant_id_academic_year_id_idx" ON "leave_balances"("tenant_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_staff_id_leave_type_id_academic_year_id_key" ON "leave_balances"("staff_id", "leave_type_id", "academic_year_id");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_status_applied_at_idx" ON "leave_requests"("tenant_id", "status", "applied_at");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_staff_id_from_date_idx" ON "leave_requests"("tenant_id", "staff_id", "from_date");

-- CreateIndex
CREATE INDEX "leave_requests_tenant_id_current_approver_id_status_idx" ON "leave_requests"("tenant_id", "current_approver_id", "status");

-- CreateIndex
CREATE INDEX "leave_approval_steps_tenant_id_leave_request_id_idx" ON "leave_approval_steps"("tenant_id", "leave_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_approval_steps_leave_request_id_sequence_key" ON "leave_approval_steps"("leave_request_id", "sequence");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_campus_id_status_idx" ON "shifts"("tenant_id", "campus_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_tenant_id_campus_id_name_key" ON "shifts"("tenant_id", "campus_id", "name");

-- CreateIndex
CREATE INDEX "shift_assignments_tenant_id_staff_id_effective_from_idx" ON "shift_assignments"("tenant_id", "staff_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shift_id_staff_id_effective_from_key" ON "shift_assignments"("shift_id", "staff_id", "effective_from");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_attendance_date_status_idx" ON "attendance_records"("tenant_id", "attendance_date", "status");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_campus_id_attendance_date_idx" ON "attendance_records"("tenant_id", "campus_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_staff_id_attendance_date_key" ON "attendance_records"("staff_id", "attendance_date");

-- CreateIndex
CREATE INDEX "appraisal_cycles_tenant_id_is_open_idx" ON "appraisal_cycles"("tenant_id", "is_open");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_cycles_tenant_id_name_key" ON "appraisal_cycles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "appraisal_metric_templates_tenant_id_category_id_idx" ON "appraisal_metric_templates"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_metric_templates_category_id_name_key" ON "appraisal_metric_templates"("category_id", "name");

-- CreateIndex
CREATE INDEX "appraisal_reviews_tenant_id_cycle_id_stage_idx" ON "appraisal_reviews"("tenant_id", "cycle_id", "stage");

-- CreateIndex
CREATE INDEX "appraisal_reviews_tenant_id_staff_id_idx" ON "appraisal_reviews"("tenant_id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_reviews_cycle_id_staff_id_key" ON "appraisal_reviews"("cycle_id", "staff_id");

-- CreateIndex
CREATE INDEX "appraisal_review_metrics_review_id_idx" ON "appraisal_review_metrics"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_review_metrics_review_id_name_key" ON "appraisal_review_metrics"("review_id", "name");

-- CreateIndex
CREATE INDEX "appraisal_comments_review_id_created_at_idx" ON "appraisal_comments"("review_id", "created_at");

-- AddForeignKey
ALTER TABLE "hrms_categories" ADD CONSTRAINT "hrms_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrms_departments" ADD CONSTRAINT "hrms_departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrms_departments" ADD CONSTRAINT "hrms_departments_academic_department_id_fkey" FOREIGN KEY ("academic_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hrms_departments" ADD CONSTRAINT "hrms_departments_head_staff_id_fkey" FOREIGN KEY ("head_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "hrms_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hrms_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_current_approver_id_fkey" FOREIGN KEY ("current_approver_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_steps" ADD CONSTRAINT "leave_approval_steps_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_metric_templates" ADD CONSTRAINT "appraisal_metric_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_metric_templates" ADD CONSTRAINT "appraisal_metric_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "hrms_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_reviews" ADD CONSTRAINT "appraisal_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_reviews" ADD CONSTRAINT "appraisal_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "appraisal_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_reviews" ADD CONSTRAINT "appraisal_reviews_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_review_metrics" ADD CONSTRAINT "appraisal_review_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_review_metrics" ADD CONSTRAINT "appraisal_review_metrics_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "appraisal_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_comments" ADD CONSTRAINT "appraisal_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_comments" ADD CONSTRAINT "appraisal_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "appraisal_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Rules Prisma cannot express (hand-written; keep when regenerating)
-- ---------------------------------------------------------------------------

-- Case-insensitive uniqueness for lookup names / codes
CREATE UNIQUE INDEX "hrms_categories_tenant_lower_name_key" ON "hrms_categories" ("tenant_id", lower("name"));
CREATE UNIQUE INDEX "hrms_departments_tenant_lower_name_key" ON "hrms_departments" ("tenant_id", lower("name"));
CREATE UNIQUE INDEX "leave_types_tenant_lower_code_key" ON "leave_types" ("tenant_id", lower("code"));

-- Appraisal scores are 1-5
ALTER TABLE "appraisal_review_metrics"
  ADD CONSTRAINT "appraisal_review_metrics_scores_range_chk" CHECK (
    ("self_score" IS NULL OR "self_score" BETWEEN 1 AND 5) AND
    ("hod_score" IS NULL OR "hod_score" BETWEEN 1 AND 5) AND
    ("principal_score" IS NULL OR "principal_score" BETWEEN 1 AND 5)
  );

-- Leave integrity
ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_date_range_chk" CHECK ("to_date" >= "from_date"),
  ADD CONSTRAINT "leave_requests_days_positive_chk" CHECK ("days" > 0);
ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_used_nonneg_chk" CHECK ("used" >= 0);

-- A staff member cannot report to themselves
ALTER TABLE "staff"
  ADD CONSTRAINT "staff_not_own_manager_chk" CHECK ("reporting_manager_id" IS NULL OR "reporting_manager_id" <> "id");
