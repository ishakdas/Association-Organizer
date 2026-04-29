/**
 * Dev-only reset script.
 *
 * Resets the Genel Başkan (SYSTEM_ADMIN) onboarding state and clears all
 * test branch-registration records + branch data so the full flow can be
 * re-tested from scratch with any email addresses.
 *
 * Does NOT touch MemberTitleDefinition or the system-root Association seed row.
 * Does NOT delete Supabase auth users (requires service-role key separately).
 *
 * Usage:
 *   pnpm --filter @ticketbot/database exec tsx prisma/dev-reset.ts
 */

import { PrismaClient } from '@prisma/client';

const SYSTEM_ROOT_ID = 'ckv_seed_systemroot______';

async function main() {
  const prisma = new PrismaClient();

  try {
    // ── 1. Reset all SYSTEM_ADMIN users' onboarding state ─────────────────
    const admins = await prisma.user.findMany({
      where: {
        memberships: {
          some: { role: 'SYSTEM_ADMIN', isActive: true },
        },
      },
      select: { id: true, email: true },
    });

    if (admins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: admins.map((u) => u.id) } },
        data: { onboardingCompletedAt: null },
      });
      console.log(`✓ Onboarding sıfırlandı: ${admins.length} SYSTEM_ADMIN kullanıcı`);
    } else {
      console.log('  Hiç SYSTEM_ADMIN kullanıcısı bulunamadı.');
    }

    // ── 2. Delete all PendingBranchRegistration records ───────────────────
    const { count: regCount } = await prisma.pendingBranchRegistration.deleteMany({});
    console.log(`✓ Silinen başvuru kaydı: ${regCount}`);

    // ── 3. Delete all non-system-root Associations and cascade ────────────
    //    (tasks, meetings, memberships cascade via Prisma/FK)
    const branches = await prisma.association.findMany({
      where: { id: { not: SYSTEM_ROOT_ID } },
      select: { id: true, name: true },
    });

    if (branches.length > 0) {
      // Hard-delete tasks, meetings, memberships first (soft-delete columns
      // would leave orphaned rows; for dev reset we go hard)
      const branchIds = branches.map((b) => b.id);

      await prisma.taskActivity.deleteMany({
        where: { task: { associationId: { in: branchIds } } },
      });
      await prisma.meetingAttendee.deleteMany({
        where: { meetingNote: { associationId: { in: branchIds } } },
      });
      await prisma.task.deleteMany({ where: { associationId: { in: branchIds } } });
      await prisma.meetingNote.deleteMany({ where: { associationId: { in: branchIds } } });
      await prisma.associationMembership.deleteMany({
        where: { associationId: { in: branchIds } },
      });
      await prisma.association.deleteMany({ where: { id: { in: branchIds } } });

      console.log(`✓ Silinen şube: ${branches.length} (${branches.map((b) => b.name).join(', ')})`);
    } else {
      console.log('  Silinecek şube bulunamadı.');
    }

    // ── 4. Delete branch Users (non-SYSTEM_ADMIN, have supabaseUserId) ────
    const branchUsers = await prisma.user.findMany({
      where: {
        memberships: { none: { role: 'SYSTEM_ADMIN' } },
        supabaseUserId: { not: null },
      },
      select: { id: true, email: true, supabaseUserId: true },
    });

    if (branchUsers.length > 0) {
      await prisma.telegramAccount.deleteMany({
        where: { userId: { in: branchUsers.map((u) => u.id) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: branchUsers.map((u) => u.id) } },
      });
      console.log(`✓ Silinen şube kullanıcısı: ${branchUsers.length}`);
      console.log(
        '\n⚠️  Supabase auth kullanıcıları manuel silinmeli (Authentication > Users):',
      );
      for (const u of branchUsers) {
        console.log(`   - ${u.email} (supabaseUserId: ${u.supabaseUserId})`);
      }
    } else {
      console.log('  Silinecek şube kullanıcısı bulunamadı.');
    }

    // ── 5. Also clear onboarding cookie reminder ──────────────────────────
    console.log(
      '\n💡 Tarayıcıda "onboarding_done" çerezini de temizlemeyi unutma (DevTools > Application > Cookies).',
    );

    console.log('\n✅ Dev reset tamamlandı. Şimdi pnpm db:seed çalıştırabilirsin.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
