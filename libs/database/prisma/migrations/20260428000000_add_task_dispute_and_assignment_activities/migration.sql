-- AlterEnum
ALTER TYPE "TaskActivityAction" ADD VALUE 'ASSIGNED_NOTIFIED';
ALTER TYPE "TaskActivityAction" ADD VALUE 'REASSIGNMENT_REQUESTED';
ALTER TYPE "TaskActivityAction" ADD VALUE 'REASSIGNMENT_RESOLVED';

-- AlterTable
ALTER TABLE "tasks"
  ADD COLUMN "disputed"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disputedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_associationId_disputed_idx" ON "tasks"("associationId", "disputed");
