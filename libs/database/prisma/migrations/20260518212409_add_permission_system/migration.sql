/*
  Warnings:

  - You are about to drop the `finance_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `meeting_permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('MANAGE_MEMBERS', 'VIEW_MEMBERS', 'CREATE_TASKS', 'ASSIGN_TASKS', 'UPDATE_TASK_STATUS', 'DELETE_TASKS', 'VIEW_TASKS', 'CREATE_MEETINGS', 'EDIT_MEETINGS', 'DELETE_MEETINGS', 'VIEW_MEETINGS', 'CREATE_EVENTS', 'EDIT_EVENTS', 'DELETE_EVENTS', 'MANAGE_EVENT_ASSIGNMENTS', 'VIEW_EVENTS', 'CREATE_TRANSACTIONS', 'DELETE_TRANSACTIONS', 'MANAGE_CATEGORIES', 'VIEW_FINANCE', 'MANAGE_FINANCE_SETTINGS', 'MANAGE_ASSOCIATION_SETTINGS');

-- DropForeignKey
ALTER TABLE "finance_permissions" DROP CONSTRAINT "finance_permissions_associationId_fkey";

-- DropForeignKey
ALTER TABLE "finance_permissions" DROP CONSTRAINT "finance_permissions_grantedById_fkey";

-- DropForeignKey
ALTER TABLE "finance_permissions" DROP CONSTRAINT "finance_permissions_userId_fkey";

-- DropForeignKey
ALTER TABLE "meeting_permissions" DROP CONSTRAINT "meeting_permissions_associationId_fkey";

-- DropForeignKey
ALTER TABLE "meeting_permissions" DROP CONSTRAINT "meeting_permissions_grantedById_fkey";

-- DropForeignKey
ALTER TABLE "meeting_permissions" DROP CONSTRAINT "meeting_permissions_userId_fkey";

-- DropTable
DROP TABLE "finance_permissions";

-- DropTable
DROP TABLE "meeting_permissions";

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permissions_associationId_userId_idx" ON "permissions"("associationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_associationId_userId_action_key" ON "permissions"("associationId", "userId", "action");

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
