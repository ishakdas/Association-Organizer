-- DropForeignKey
ALTER TABLE "member_title_assignments" DROP CONSTRAINT "member_title_assignments_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "member_title_assignments" DROP CONSTRAINT "member_title_assignments_titleId_fkey";

-- AddForeignKey
ALTER TABLE "member_title_assignments" ADD CONSTRAINT "member_title_assignments_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "association_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_title_assignments" ADD CONSTRAINT "member_title_assignments_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "member_title_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
