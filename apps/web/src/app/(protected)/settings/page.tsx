import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Building2,
  Info,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin, activeMemberships, canManageMembers } from '@/lib/permissions';

export const metadata = { title: 'Ayarlar' };

interface SettingsCard {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  systemAdminOnly?: boolean;
  badge?: string;
}

const CARDS: readonly SettingsCard[] = [
  {
    href: '/settings/profile',
    label: 'Hesabım',
    description: 'Ad-soyad, telefon ve parola.',
    icon: UserCog,
  },
  {
    href: '/settings/telegram',
    label: 'Telegram Bağlantısı',
    description: 'Görev hatırlatıcılarını alacağın Telegram hesabı.',
    icon: MessageSquare,
  },
  {
    href: '/settings/titles',
    label: 'Üye Unvanları',
    description: 'Atanabilir unvanları ekle, düzenle, pasife çek.',
    icon: Tags,
    systemAdminOnly: true,
    badge: 'Sistem',
  },
  {
    href: '/settings/system-admins',
    label: 'Sistem Yöneticileri',
    description: 'Yönetici rollerini ata veya kaldır.',
    icon: ShieldCheck,
    systemAdminOnly: true,
    badge: 'Sistem',
  },
  {
    href: '/settings/associations',
    label: 'Dernekler',
    description: 'Tüm dernekleri yönet, sil, geri yükle.',
    icon: Building2,
    systemAdminOnly: true,
    badge: 'Sistem',
  },
  {
    href: '/settings/link-tokens',
    label: 'Bağlantı Kodları',
    description: 'Açık kalmış Telegram bağlantı kodlarını temizle.',
    icon: KeyRound,
    systemAdminOnly: true,
    badge: 'Sistem',
  },
];

export default async function SettingsHubPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) redirect('/login');

  let me: AuthenticatedUser | null = null;
  try {
    me = await getMe(session.access_token);
  } catch {
    me = null;
  }

  const visible = CARDS.filter((c) => !c.systemAdminOnly || isSystemAdmin(me));

  const memberAssocId = !isSystemAdmin(me)
    ? (activeMemberships(me)[0]?.associationId ?? null)
    : null;

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-1.5 border-b border-border pb-6">
        <span className="eyebrow">Yönetim</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Ayarlar
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Hesabını
          {isSystemAdmin(me) ? ' ve sistem genelindeki ayarları ' : ' '}
          buradan yönet.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <SettingsCardLink key={card.href} card={card} />
        ))}
        {memberAssocId && (
          <SettingsCardLink
            card={{
              href: `/settings/association-info`,
              label: 'Şube Bilgileri',
              description: 'Şubenin genel bilgilerini görüntüle.',
              icon: Info,
            }}
          />
        )}
        {memberAssocId && canManageMembers(me, memberAssocId) && (
          <SettingsCardLink
            card={{
              href: `/settings/permissions`,
              label: 'Yetki',
              description: 'Şube finans yetkilerini yönet.',
              icon: Users,
            }}
          />
        )}
      </div>
    </div>
  );
}

function SettingsCardLink({ card }: { card: SettingsCard }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background">
          <Icon className="h-4 w-4" />
        </span>
        {card.badge && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {card.badge}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
          {card.label}
        </h2>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {card.description}
        </p>
      </div>
    </Link>
  );
}
