-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'TALK', 'SEMINAR', 'IFTAR', 'KANDIL', 'MEETING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "event_role_definitions" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "event_role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'CUSTOM',
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "notifyAt" TIMESTAMP(3) NOT NULL,
    "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "recurrenceEndsAt" TIMESTAMP(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_assignments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "roleDefinitionId" TEXT,
    "customRole" TEXT,
    "notes" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_role_definitions_associationId_name_key" ON "event_role_definitions"("associationId", "name");

-- CreateIndex
CREATE INDEX "event_role_definitions_associationId_deletedAt_idx" ON "event_role_definitions"("associationId", "deletedAt");

-- CreateIndex
CREATE INDEX "events_associationId_startsAt_idx" ON "events"("associationId", "startsAt");

-- CreateIndex
CREATE INDEX "events_associationId_deletedAt_idx" ON "events"("associationId", "deletedAt");

-- CreateIndex
CREATE INDEX "events_notifyAt_idx" ON "events"("notifyAt");

-- CreateIndex
CREATE INDEX "event_assignments_eventId_idx" ON "event_assignments"("eventId");

-- CreateIndex
CREATE INDEX "event_assignments_membershipId_idx" ON "event_assignments"("membershipId");

-- CreateIndex
CREATE INDEX "event_assignments_roleDefinitionId_idx" ON "event_assignments"("roleDefinitionId");

-- AddForeignKey
ALTER TABLE "event_role_definitions" ADD CONSTRAINT "event_role_definitions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "association_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_roleDefinitionId_fkey" FOREIGN KEY ("roleDefinitionId") REFERENCES "event_role_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
