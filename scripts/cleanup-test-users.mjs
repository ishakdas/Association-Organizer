/**
 * Test kullanıcı verilerini temizler.
 * Kullanım: node scripts/cleanup-test-users.mjs [email1] [email2] ...
 *
 * Email belirtilmezse silinecek kayıtları listeler (dry-run).
 * Email belirtilirse sadece o e-postalara ait veriler silinir.
 *
 * Örnek:
 *   node scripts/cleanup-test-users.mjs                      # Listele
 *   node scripts/cleanup-test-users.mjs test@example.com     # Sil
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.env.DATABASE_URL = process.env.DATABASE_URL ??
  'postgresql://ticketbot:ticketbot@localhost:5432/ticketbot?schema=public';

const { PrismaClient } = require('./libs/database/node_modules/@prisma/client');
const prisma = new PrismaClient();

const targetEmails = process.argv.slice(2);
const dryRun = targetEmails.length === 0;

async function main() {
  const registrations = await prisma.pendingBranchRegistration.findMany({
    orderBy: { createdAt: 'desc' },
    ...(targetEmails.length ? { where: { email: { in: targetEmails } } } : {}),
  });

  const users = await prisma.user.findMany({
    where: {
      systemRole: null,
      ...(targetEmails.length ? { email: { in: targetEmails } } : {}),
    },
    include: { memberships: true },
  });

  console.log('\n=== PendingBranchRegistration ===');
  registrations.forEach(r => console.log(`  [${r.status}] ${r.email} — ${r.fullName} (${r.id})`));

  console.log('\n=== Users (non-admin) ===');
  users.forEach(u => console.log(`  ${u.email} — ${u.fullName} | memberships: ${u.memberships.length} (userId: ${u.id})`));

  if (dryRun) {
    console.log('\nDry-run: yukarıdaki kayıtlar silinecek. Silmek için e-posta adresi girin:');
    console.log('  node scripts/cleanup-test-users.mjs test@example.com\n');
    return;
  }

  if (registrations.length === 0 && users.length === 0) {
    console.log('\nSilinecek kayıt bulunamadı.\n');
    return;
  }

  const userIds = users.map(u => u.id);

  await prisma.$transaction(async (tx) => {
    if (userIds.length) {
      const del1 = await tx.associationMembership.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`\nAssociationMembership silindi: ${del1.count}`);

      const del2 = await tx.telegramAccount.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`TelegramAccount silindi: ${del2.count}`);

      const del3 = await tx.telegramLinkToken.deleteMany({ where: { userId: { in: userIds } } });
      console.log(`TelegramLinkToken silindi: ${del3.count}`);

      const del4 = await tx.user.deleteMany({ where: { id: { in: userIds } } });
      console.log(`User silindi: ${del4.count}`);
    }

    if (registrations.length) {
      const regEmails = registrations.map(r => r.email);
      const del5 = await tx.pendingBranchRegistration.deleteMany({ where: { email: { in: regEmails } } });
      console.log(`PendingBranchRegistration silindi: ${del5.count}`);
    }
  });

  console.log('\nTemizlik tamamlandı.');
  console.log('Not: Supabase\'deki kullanıcı hesaplarını Supabase Dashboard > Authentication > Users bölümünden manuel silmeniz gerekiyor.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
