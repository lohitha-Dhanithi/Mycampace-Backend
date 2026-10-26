CREATE TYPE "CurriculumStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SemesterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "CalendarEventType" AS ENUM ('HOLIDAY', 'BREAK', 'EXAM', 'EVENT', 'OTHER');

CREATE TABLE "curricula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "status" "CurriculumStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "curricula_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curricula_tenant_id_program_id_academic_year_id_code_key" ON "curricula"("tenant_id", "program_id", "academic_year_id", "code");
CREATE INDEX "curricula_tenant_id_institution_id_status_idx" ON "curricula"("tenant_id", "institution_id", "status");
CREATE INDEX "curricula_tenant_id_academic_year_id_status_idx" ON "curricula"("tenant_id", "academic_year_id", "status");
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "curriculum_courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "curriculum_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "curriculum_courses_curriculum_id_course_id_key" ON "curriculum_courses"("curriculum_id", "course_id");
CREATE INDEX "curriculum_courses_tenant_id_curriculum_id_idx" ON "curriculum_courses"("tenant_id", "curriculum_id");
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "semesters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "SemesterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "semesters_tenant_id_academic_year_id_code_key" ON "semesters"("tenant_id", "academic_year_id", "code");
CREATE INDEX "semesters_tenant_id_academic_year_id_status_idx" ON "semesters"("tenant_id", "academic_year_id", "status");
CREATE INDEX "semesters_tenant_id_institution_id_status_idx" ON "semesters"("tenant_id", "institution_id", "status");
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "semester_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "event_type" "CalendarEventType" NOT NULL DEFAULT 'EVENT',
    "description" VARCHAR(500),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calendar_events_tenant_id_academic_year_id_start_date_idx" ON "calendar_events"("tenant_id", "academic_year_id", "start_date");
CREATE INDEX "calendar_events_tenant_id_institution_id_status_idx" ON "calendar_events"("tenant_id", "institution_id", "status");
CREATE INDEX "calendar_events_tenant_id_event_type_idx" ON "calendar_events"("tenant_id", "event_type");
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "display_name", "description", "module", "action", "is_system", "is_active", "updated_at") VALUES
(gen_random_uuid(), 'academic.curriculum.read', 'View curricula', 'View curriculum configurations', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.curriculum.manage', 'Manage curricula', 'Create, update, archive curricula', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.semester.read', 'View semesters', 'View semesters and terms', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.semester.manage', 'Manage semesters', 'Create, update, archive semesters', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.calendar.read', 'View academic calendar', 'View academic calendar events', 'academic', 'READ', true, true, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'academic.calendar.manage', 'Manage academic calendar', 'Create, update, archive calendar events', 'academic', 'MANAGE', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'academic.curriculum.read','academic.curriculum.manage',
  'academic.semester.read','academic.semester.manage',
  'academic.calendar.read','academic.calendar.manage'
)
WHERE r.code IN ('PRINCIPAL','VICE_PRINCIPAL','REGISTRAR','ACADEMIC_DIRECTOR','DEAN','FOUNDER','CEO','MANAGING_DIRECTOR')
  AND r.tenant_id IS NULL ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'academic.curriculum.read','academic.semester.read','academic.calendar.read'
)
WHERE r.code IN ('FACULTY','HEAD_OF_DEPARTMENT','PROFESSOR','SCHOOL_TEACHER')
  AND r.tenant_id IS NULL ON CONFLICT DO NOTHING;
