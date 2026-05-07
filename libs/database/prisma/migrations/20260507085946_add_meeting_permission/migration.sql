-- CreateTable
CREATE TABLE "meeting_permissions" (
    "id" TEXT NOT NULL,
    "associationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "meeting_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_permissions_associationId_isActive_idx" ON "meeting_permissions"("associationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_permissions_associationId_userId_key" ON "meeting_permissions"("associationId", "userId");

-- AddForeignKey
ALTER TABLE "meeting_permissions" ADD CONSTRAINT "meeting_permissions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_permissions" ADD CONSTRAINT "meeting_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_permissions" ADD CONSTRAINT "meeting_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
