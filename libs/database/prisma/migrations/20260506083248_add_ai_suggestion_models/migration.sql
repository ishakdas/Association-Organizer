-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "suggestedTiming" TEXT NOT NULL,
    "keyTopics" TEXT[],
    "resourcesNeeded" TEXT NOT NULL,
    "estimatedParticipants" TEXT NOT NULL,
    "islamicSession" JSONB,
    "schedule" JSONB,
    "socialContent" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestion_feedbacks" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "isHelpful" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestion_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_program_items" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_program_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_suggestions_associationId_createdAt_idx" ON "ai_suggestions"("associationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_suggestion_feedbacks_suggestionId_key" ON "ai_suggestion_feedbacks"("suggestionId");

-- CreateIndex
CREATE INDEX "saved_suggestions_userId_idx" ON "saved_suggestions"("userId");

-- CreateIndex
CREATE INDEX "saved_suggestions_suggestionId_idx" ON "saved_suggestions"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_suggestions_userId_suggestionId_key" ON "saved_suggestions"("userId", "suggestionId");

-- CreateIndex
CREATE INDEX "event_program_items_eventId_idx" ON "event_program_items"("eventId");

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestion_feedbacks" ADD CONSTRAINT "ai_suggestion_feedbacks_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ai_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_suggestions" ADD CONSTRAINT "saved_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_suggestions" ADD CONSTRAINT "saved_suggestions_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ai_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_program_items" ADD CONSTRAINT "event_program_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
