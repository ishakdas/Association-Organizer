-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "resendId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");
