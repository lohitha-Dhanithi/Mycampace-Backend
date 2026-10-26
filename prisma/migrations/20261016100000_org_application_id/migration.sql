-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "applicationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_applicationId_key" ON "Organization"("applicationId");

-- Backfill: give every organization that already entered the verification queue (or was grandfathered) an Application ID.
-- Derived from the organization id, so it is unique and stable. New applications get theirs from the backend on submission.
UPDATE "Organization"
SET "applicationId" = 'MC-' || to_char(COALESCE("verificationSubmittedAt", "createdAt"), 'YYYY') || '-' || upper(substr(md5("id"), 1, 6))
WHERE "verificationStatus" <> 'Draft' AND "applicationId" IS NULL;
