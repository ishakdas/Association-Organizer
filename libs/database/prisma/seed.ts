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
  await prisma.user.upsert({
    where: { email: 'admin@dev.local' },
    update: { fullName: 'Sistem Yöneticisi', isActive: true },
    create: {
      email: 'admin@dev.local',
      fullName: 'Sistem Yöneticisi',
      isActive: true,
    },
  });

  const titleCount = await prisma.memberTitleDefinition.count();
  const userCount = await prisma.user.count();
  console.log(`Seed complete: ${titleCount} titles, ${userCount} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
