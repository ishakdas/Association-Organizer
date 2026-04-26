-- DropForeignKey
ALTER TABLE "association_memberships" DROP CONSTRAINT "association_memberships_associationId_fkey";

-- AlterTable
ALTER TABLE "association_memberships" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "association_memberships_deletedAt_idx" ON "association_memberships"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_assignedToUserId_associationId_status_idx" ON "tasks"("assignedToUserId", "associationId", "status");

-- AddForeignKey
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
