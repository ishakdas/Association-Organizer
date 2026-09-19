CREATE UNIQUE INDEX "one_active_manager_per_association"
ON "association_memberships" ("associationId")
WHERE "role" = 'ASSOCIATION_MANAGER'::"UserRole"
  AND "isActive" = true
  AND "deletedAt" IS NULL;
