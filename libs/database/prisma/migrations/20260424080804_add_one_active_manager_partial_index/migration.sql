-- Partial unique index: enforce ONE active ASSOCIATION_MANAGER per association.
-- Prisma schema DSL cannot express partial unique indexes, so this is a manual migration.
-- "Active" = leftAt IS NULL AND isActive = true.
-- Inserting/updating a second row matching this WHERE for the same associationId
-- raises a unique violation (Prisma error code P2002).
CREATE UNIQUE INDEX "one_active_manager_per_association"
  ON "association_memberships" ("associationId")
  WHERE "role" = 'ASSOCIATION_MANAGER' AND "isActive" = true AND "leftAt" IS NULL;
