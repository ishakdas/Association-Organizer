/**
 * Manually link a local User row to a Supabase auth user by email.
 *
 * Use when:
 *   - Seed created the User row before the Supabase auth user existed.
 *   - Or the user was added in Supabase Studio but never logged in via the
 *     web app, so AuthGuard's auto-link upsert never fired.
 *
 * Usage:
 *   pnpm dotenv -e apps/api/.env -- pnpm tsx apps/api/scripts/link-supabase-user.ts <email>
 *
 * Example:
 *   pnpm dotenv -e apps/api/.env -- pnpm tsx apps/api/scripts/link-supabase-user.ts admin@dev.local
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: tsx apps/api/scripts/link-supabase-user.ts <email>');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Paginate listUsers (Supabase default page size 50; admin instances are tiny)
  let authUser: { id: string; email: string | undefined } | null = null;
  let page = 1;
  while (!authUser) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    authUser =
      data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ??
      null;
    if (authUser) break;
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!authUser) {
    console.error(`No Supabase auth user found with email ${email}`);
    console.error(
      'Create one in Supabase Studio → Authentication → Users first.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (!dbUser) {
      console.error(
        `No DB user found with email ${email}. Run seed or insert the row first.`,
      );
      process.exit(1);
    }

    if (dbUser.supabaseUserId && dbUser.supabaseUserId !== authUser.id) {
      console.error(
        `DB user already linked to a different supabaseUserId (${dbUser.supabaseUserId}). ` +
          `Refusing to overwrite.`,
      );
      process.exit(1);
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { supabaseUserId: authUser.id },
      select: {
        id: true,
        email: true,
        supabaseUserId: true,
        isSystemAdmin: true,
        isActive: true,
      },
    });

    console.log('✅ Linked:');
    console.log(`   email          : ${updated.email}`);
    console.log(`   id (local)     : ${updated.id}`);
    console.log(`   supabaseUserId : ${updated.supabaseUserId}`);
    console.log(`   isSystemAdmin  : ${updated.isSystemAdmin}`);
    console.log(`   isActive       : ${updated.isActive}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
