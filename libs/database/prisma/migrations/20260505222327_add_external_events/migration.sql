-- CreateTable
CREATE TABLE "external_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT,
    "description" TEXT,
    "detailUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_events_source_eventDate_idx" ON "external_events"("source", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "external_events_source_externalId_key" ON "external_events"("source", "externalId");
