import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Admin-managed assignable titles. Order matters for UI sortOrder.
const TITLES = [
  'Teşkilat Başkanı',
  'Lise Başkanı',
  'Orta Okul Başkanı',
  'Kadın Kolları Başkanı',
  'Kültür-Sanat Sorumlusu',
  'Gençlik Kolu Sorumlusu',
  'Medya Sorumlusu',
  'Mali İşler Sorumlusu',
] as const;

const TURKISH_TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c',
  ğ: 'g', Ğ: 'g',
  ı: 'i', I: 'i', İ: 'i',
  ö: 'o', Ö: 'o',
  ş: 's', Ş: 's',
  ü: 'u', Ü: 'u',
};

function slugify(input: string): string {
  return input
    .split('')
    .map((ch) => TURKISH_TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  // Reference data — assignable member titles
  for (let i = 0; i < TITLES.length; i++) {
    const name = TITLES[i];
    const slug = slugify(name);
    await prisma.memberTitleDefinition.upsert({
      where: { slug },
      update: { name, sortOrder: i, isActive: true },
      create: { name, slug, sortOrder: i, isActive: true },
    });
  }

  // Dev-only system admin (no Supabase link). Real admins log in via Supabase
  // and get auto-provisioned by AuthGuard.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dev.local' },
    update: { fullName: 'Sistem Yöneticisi', isActive: true },
    create: {
      email: 'admin@dev.local',
      fullName: 'Sistem Yöneticisi',
      isActive: true,
    },
  });

  // Sentinel "system root" association — its only purpose is to carry the
  // SYSTEM_ADMIN membership grant. RolesGuard / AssociationRolesGuard derive
  // systemRole from any active SYSTEM_ADMIN membership row.
  const SYSTEM_ROOT_ID = 'ckv_seed_systemroot______';
  await prisma.association.upsert({
    where: { id: SYSTEM_ROOT_ID },
    update: { isActive: true },
    create: {
      id: SYSTEM_ROOT_ID,
      name: 'Sistem (seed)',
      taxNumber: '0000000000',
      foundedAt: new Date('2020-01-01T00:00:00.000Z'),
      address: 'Seed',
      city: 'Seed',
      district: 'Seed',
      phone: '+905550000000',
      email: 'system-root@dev.local',
      activityArea: 'System',
      memberCount: 0,
      isActive: true,
      createdById: admin.id,
    },
  });

  await prisma.associationMembership.upsert({
    where: {
      userId_associationId_role: {
        userId: admin.id,
        associationId: SYSTEM_ROOT_ID,
        role: 'SYSTEM_ADMIN',
      },
    },
    update: { isActive: true },
    create: {
      userId: admin.id,
      associationId: SYSTEM_ROOT_ID,
      role: 'SYSTEM_ADMIN',
      isActive: true,
    },
  });

  const titleCount = await prisma.memberTitleDefinition.count();
  const userCount = await prisma.user.count();
  const adminCount = await prisma.associationMembership.count({
    where: { role: 'SYSTEM_ADMIN', isActive: true },
  });
  console.log(
    `Seed complete: ${titleCount} titles, ${userCount} users, ${adminCount} active SYSTEM_ADMIN memberships`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
