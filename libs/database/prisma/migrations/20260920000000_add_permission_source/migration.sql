CREATE TYPE "PermissionSource" AS ENUM ('MANUAL', 'TITLE', 'MEMBERSHIP');

ALTER TABLE "permissions"
ADD COLUMN "source" "PermissionSource" NOT NULL DEFAULT 'MANUAL';

DROP INDEX "permissions_associationId_userId_action_key";

CREATE UNIQUE INDEX "permissions_associationId_userId_action_source_key"
ON "permissions"("associationId", "userId", "action", "source");
