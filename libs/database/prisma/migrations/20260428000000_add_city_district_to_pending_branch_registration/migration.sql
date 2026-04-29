-- AlterTable
ALTER TABLE "pending_branch_registrations" ADD COLUMN "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN "district" TEXT NOT NULL DEFAULT '';
