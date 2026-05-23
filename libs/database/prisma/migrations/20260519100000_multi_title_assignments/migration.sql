-- Create the new member_title_assignments table
CREATE TABLE "member_title_assignments" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "titleId" TEXT,
    "customTitle" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_title_assignments_pkey" PRIMARY KEY ("id")
);

-- Migrate existing data: every membership with a titleId or customTitle gets
-- a new row in member_title_assignments with isPrimary = true
INSERT INTO "member_title_assignments" ("id", "membershipId", "titleId", "customTitle", "isPrimary", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    am."id",
    am."titleId",
    am."customTitle",
    true,
    0,
    NOW()
FROM "association_memberships" am
WHERE am."titleId" IS NOT NULL OR am."customTitle" IS NOT NULL;

-- Add foreign key from member_title_assignments to association_memberships
ALTER TABLE "member_title_assignments" ADD CONSTRAINT "member_title_assignments_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "association_memberships"("id") ON DELETE CASCADE;

-- Add foreign key from member_title_assignments to member_title_definitions
ALTER TABLE "member_title_assignments" ADD CONSTRAINT "member_title_assignments_titleId_fkey"
    FOREIGN KEY ("titleId") REFERENCES "member_title_definitions"("id") ON DELETE SET NULL;

-- Create indexes
CREATE INDEX "member_title_assignments_membershipId_isPrimary_idx" ON "member_title_assignments"("membershipId", "isPrimary");
CREATE INDEX "member_title_assignments_membershipId_sortOrder_idx" ON "member_title_assignments"("membershipId", "sortOrder");

-- Drop the old columns from association_memberships
ALTER TABLE "association_memberships" DROP COLUMN "titleId";
ALTER TABLE "association_memberships" DROP COLUMN "customTitle";
