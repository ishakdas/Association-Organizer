import { PrismaClient } from '@prisma/client';

// Grants SYSTEM_ADMIN to every User row that has a Supabase link
// (i.e. has logged in at least once through Supabase and was
// auto-provisioned by AuthGuard). Idempotent — the SYSTEM_ADMIN
// membership is upserted against the seed's SYSTEM_ROOT association.
//
// Usage:  pnpm --filter @ticketbot/database exec tsx prisma/grant-admin.ts
//
// Prints counts only, never email or user identifiers, so it is safe
// to run in shared sessions.

const SYSTEM_ROOT_ID = 'ckv_seed_systemroot______';

async function main() {
  const prisma = new PrismaClient();
  try {
    const linked = await prisma.user.findMany({
      where: { supabaseUserId: { not: null }, isActive: true },
      select: { id: true },
    });

    if (linked.length === 0) {
      console.log(
        'No Supabase-linked users found. Log into the web app once, then re-run.',
      );
      return;
    }

    let granted = 0;
    for (const u of linked) {
      await prisma.associationMembership.upsert({
        where: {
          userId_associationId_role: {
            userId: u.id,
            associationId: SYSTEM_ROOT_ID,
            role: 'SYSTEM_ADMIN',
          },
        },
        update: { isActive: true, deletedAt: null },
        create: {
          userId: u.id,
          associationId: SYSTEM_ROOT_ID,
          role: 'SYSTEM_ADMIN',
          isActive: true,
        },
      });
      granted += 1;
    }

    console.log(
      `Granted SYSTEM_ADMIN to ${granted} Supabase-linked user(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
