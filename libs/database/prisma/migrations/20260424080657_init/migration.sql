-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'ASSOCIATION_MANAGER', 'ASSOCIATION_SECRETARY', 'ASSOCIATION_MEMBER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('NONE', 'ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "member_title_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_title_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "email" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_accounts" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_link_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "associations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "taxNumber" TEXT NOT NULL,
    "foundedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "activityArea" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "titleId" TEXT,
    "customTitle" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "association_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToUserId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "reminderFrequency" "ReminderFrequency" NOT NULL DEFAULT 'NONE',
    "notifiedViaTelegram" BOOLEAN NOT NULL DEFAULT false,
    "notifiedViaWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notifiedViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedAt" TIMESTAMP(3),
    "sourceMeetingNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_notes" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "meeting_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "meetingNoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_title_definitions_name_key" ON "member_title_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "member_title_definitions_slug_key" ON "member_title_definitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseUserId_key" ON "users"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_telegramId_key" ON "telegram_accounts"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_userId_key" ON "telegram_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_tokens_token_key" ON "telegram_link_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_link_tokens_token_idx" ON "telegram_link_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_link_tokens_userId_idx" ON "telegram_link_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "associations_taxNumber_key" ON "associations"("taxNumber");

-- CreateIndex
CREATE INDEX "associations_city_idx" ON "associations"("city");

-- CreateIndex
CREATE INDEX "associations_isActive_idx" ON "associations"("isActive");

-- CreateIndex
CREATE INDEX "associations_createdById_idx" ON "associations"("createdById");

-- CreateIndex
CREATE INDEX "associations_deletedAt_idx" ON "associations"("deletedAt");

-- CreateIndex
CREATE INDEX "association_memberships_associationId_role_idx" ON "association_memberships"("associationId", "role");

-- CreateIndex
CREATE INDEX "association_memberships_userId_idx" ON "association_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "association_memberships_userId_associationId_role_key" ON "association_memberships"("userId", "associationId", "role");

-- CreateIndex
CREATE INDEX "tasks_associationId_status_idx" ON "tasks"("associationId", "status");

-- CreateIndex
CREATE INDEX "tasks_assignedToUserId_status_idx" ON "tasks"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_idx" ON "tasks"("deletedAt");

-- CreateIndex
CREATE INDEX "meeting_notes_associationId_meetingDate_idx" ON "meeting_notes"("associationId", "meetingDate");

-- CreateIndex
CREATE INDEX "meeting_notes_deletedAt_idx" ON "meeting_notes"("deletedAt");

-- CreateIndex
CREATE INDEX "meeting_attendees_userId_idx" ON "meeting_attendees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meetingNoteId_userId_key" ON "meeting_attendees"("meetingNoteId", "userId");

-- AddForeignKey
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "associations" ADD CONSTRAINT "associations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_memberships" ADD CONSTRAINT "association_memberships_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "member_title_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceMeetingNoteId_fkey" FOREIGN KEY ("sourceMeetingNoteId") REFERENCES "meeting_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meetingNoteId_fkey" FOREIGN KEY ("meetingNoteId") REFERENCES "meeting_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
