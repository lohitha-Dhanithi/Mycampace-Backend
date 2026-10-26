-- AlterEnum
ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'SuperAdmin';

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignedCampusIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable Role
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- AlterTable UserProductRole
ALTER TABLE "UserProductRole" ADD COLUMN IF NOT EXISTS "roleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Role_organizationId_productId_name_key" ON "Role"("organizationId", "productId", "name");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserProductRole_roleId_fkey') THEN
        ALTER TABLE "UserProductRole" ADD CONSTRAINT "UserProductRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
