-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('Draft', 'Submitted', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('Pending', 'Accepted', 'Rejected');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "verificationReviewedById" TEXT,
ADD COLUMN     "verificationRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'Draft',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "campusId" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'Pending',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDocument_storageKey_key" ON "OrganizationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "OrganizationDocument_organizationId_docType_idx" ON "OrganizationDocument"("organizationId", "docType");

-- AddForeignKey
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: organizations that already finished onboarding before this gate existed keep ERP access.
UPDATE "Organization"
SET "verificationStatus" = 'Approved',
    "verificationReviewedAt" = CURRENT_TIMESTAMP,
    "verificationNote" = 'Grandfathered: onboarding completed before verification gate was introduced.'
WHERE "onboardingStatus" = 'Completed';
