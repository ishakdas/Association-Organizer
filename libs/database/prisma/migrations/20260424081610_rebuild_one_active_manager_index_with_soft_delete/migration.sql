-- Rebuild "one active manager per association" partial unique index to also
-- exclude soft-deleted memberships. Without this, a soft-deleted ASSOCIATION_MANAGER
-- row would block the creation of a new active manager for the same association.
DROP INDEX "one_active_manager_per_association";

CREATE UNIQUE INDEX "one_active_manager_per_association"
  ON "association_memberships" ("associationId")
  WHERE "role" = 'ASSOCIATION_MANAGER'
    AND "isActive" = true
    AND "leftAt" IS NULL
    AND "deletedAt" IS NULL;
