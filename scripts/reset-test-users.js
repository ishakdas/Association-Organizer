#!/usr/bin/env node
/**
 * Test kullanıcı veritabanı sıfırlama scripti.
 * admin@dev.local dışındaki TÜM kullanıcıları ve pending başvuruları siler.
 * Supabase auth kullanıcılarını da temizler.
 */

const { PrismaClient } = require('../libs/database/node_modules/@prisma/client');
const { createClient } = require('../apps/api/node_modules/@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yukbwdnvgjduqauubxap.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1a2J3ZG52Z2pkdXFhdXVieGFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njk2MTg2MiwiZXhwIjoyMDkyNTM3ODYyfQ.oYrKBqxJA1iwHLZzLzIVnFgCT507XHcqPd5fK1iey9g';

const KEEP_EMAILS = ['admin@dev.local'];

async function main() {
  const prisma = new PrismaClient();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log('Kullanıcılar sorgulanıyor...');
    const users = await prisma.user.findMany({
      where: { email: { notIn: KEEP_EMAILS } },
      select: { id: true, email: true, fullName: true, supabaseUserId: true },
    });

    if (users.length === 0) {
      console.log('Silinecek kullanıcı yok.');
      return;
    }

    console.log(`\nSilinecek kullanıcılar (${users.length}):`);
    users.forEach(u => console.log(`  - ${u.email} (${u.fullName})`));

    const userIds = users.map(u => u.id);
    const supabaseIds = users.filter(u => u.supabaseUserId).map(u => u.supabaseUserId);

    // 1. DB temizliği (bağımlılık sırasına göre)
    console.log('\n[1/3] Veritabanı kayıtları siliniyor...');

    // Kullanıcılara ait tüm şubelerin verilerini al
    const memberships = await prisma.associationMembership.findMany({
      where: { userId: { in: userIds } },
      select: { associationId: true },
    });
    const assocIds = [...new Set(memberships.map(m => m.associationId))];

    // Ham SQL ile sırayla sil (FK kısıtlamalarını doğru sırayla handle et)
    const idList = userIds.map(id => `'${id}'`).join(',');
    const assocIdList = assocIds.length > 0 ? assocIds.map(id => `'${id}'`).join(',') : "'__none__'";

    // Görev aktivitelerini sil
    await prisma.$executeRawUnsafe(`DELETE FROM "task_activities" WHERE "actorId" IN (${idList})`);
    await prisma.$executeRawUnsafe(`DELETE FROM "task_activities" WHERE "taskId" IN (SELECT id FROM "tasks" WHERE "assignedToUserId" IN (${idList}))`);
    // Kullanıcılara atanmış görevleri sil
    await prisma.$executeRawUnsafe(`DELETE FROM "tasks" WHERE "assignedToUserId" IN (${idList})`);
    if (assocIds.length > 0) {
      // Şubelere ait kalan görev aktiviteleri ve görevleri sil
      await prisma.$executeRawUnsafe(`DELETE FROM "task_activities" WHERE "taskId" IN (SELECT id FROM "tasks" WHERE "associationId" IN (${assocIdList}))`);
      await prisma.$executeRawUnsafe(`DELETE FROM "tasks" WHERE "associationId" IN (${assocIdList})`);
      // Toplantı notlarını sil
      await prisma.$executeRawUnsafe(`DELETE FROM "meeting_notes" WHERE "associationId" IN (${assocIdList})`);
    }
    // Toplantı katılımcılarını sil
    await prisma.$executeRawUnsafe(`DELETE FROM "meeting_attendees" WHERE "userId" IN (${idList})`);
    // Kullanıcı bağlantı token'larını sil
    await prisma.telegramLinkToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.telegramAccount.deleteMany({ where: { userId: { in: userIds } } });
    // Üyelikleri sil
    await prisma.associationMembership.deleteMany({ where: { userId: { in: userIds } } });
    // Kullanıcıları sil
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    console.log(`  ${userIds.length} kullanıcı ve ilişkili kayıtlar silindi.`);

    // 2. PendingBranchRegistration temizliği
    console.log('\n[2/3] Başvuru kayıtları siliniyor...');
    const deleted = await prisma.pendingBranchRegistration.deleteMany({});
    console.log(`  ${deleted.count} başvuru silindi.`);

    // 3. Supabase auth kullanıcıları
    console.log('\n[3/3] Supabase auth kullanıcıları siliniyor...');
    let supabaseDeleted = 0;
    for (const uid of supabaseIds) {
      const { error } = await supabase.auth.admin.deleteUser(uid);
      if (error) {
        console.warn(`  UYARI: ${uid} silinemedi — ${error.message}`);
      } else {
        supabaseDeleted++;
      }
    }
    console.log(`  ${supabaseDeleted}/${supabaseIds.length} Supabase kullanıcısı silindi.`);

    console.log('\n✅ Tüm test kullanıcıları başarıyla temizlendi.');
    console.log(`Korunan hesap: ${KEEP_EMAILS.join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('HATA:', err.message);
  process.exit(1);
});
