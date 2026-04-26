-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "watcherUserId" TEXT;

-- CreateIndex
CREATE INDEX "tasks_watcherUserId_idx" ON "tasks"("watcherUserId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_watcherUserId_fkey" FOREIGN KEY ("watcherUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
