/*
  Warnings:

  - You are about to drop the column `suggestedTiming` on the `ai_suggestions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterTable
ALTER TABLE "ai_suggestions" DROP COLUMN "suggestedTiming";

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "expenseAmount" INTEGER,
ADD COLUMN     "expenseNote" TEXT;

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "eventId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amountInKurus" INTEGER NOT NULL,
    "description" TEXT,
    "receiptUrl" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_permissions" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "finance_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "association_settings" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "monthlyFeeAmountKurus" INTEGER,
    "yearlyFeeAmountKurus" INTEGER,
    "feeFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "association_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_categories_associationId_type_deletedAt_idx" ON "transaction_categories"("associationId", "type", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_associationId_name_key" ON "transaction_categories"("associationId", "name");

-- CreateIndex
CREATE INDEX "transactions_associationId_transactionDate_idx" ON "transactions"("associationId", "transactionDate");

-- CreateIndex
CREATE INDEX "transactions_associationId_type_deletedAt_idx" ON "transactions"("associationId", "type", "deletedAt");

-- CreateIndex
CREATE INDEX "transactions_eventId_idx" ON "transactions"("eventId");

-- CreateIndex
CREATE INDEX "finance_permissions_associationId_isActive_idx" ON "finance_permissions"("associationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "finance_permissions_associationId_userId_key" ON "finance_permissions"("associationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "association_settings_associationId_key" ON "association_settings"("associationId");

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_permissions" ADD CONSTRAINT "finance_permissions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_permissions" ADD CONSTRAINT "finance_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_permissions" ADD CONSTRAINT "finance_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "association_settings" ADD CONSTRAINT "association_settings_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
