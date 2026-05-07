'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface DetailTabsProps {
  defaultValue?: string;
  dashboard: React.ReactNode;
  ayarlar: React.ReactNode;
  uyeler: React.ReactNode;
  gorevler: React.ReactNode;
  toplantilar: React.ReactNode;
  telegram: React.ReactNode;
  finans: React.ReactNode;
}

interface TabDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

const TABS: readonly TabDef[] = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'finans', label: 'Finans', icon: Wallet },
  { value: 'uyeler', label: 'Üyeler', icon: Users },
  { value: 'gorevler', label: 'Görevler', icon: ClipboardList },
  { value: 'toplantilar', label: 'Toplantılar', icon: BookOpen },
  { value: 'telegram', label: 'Telegram', icon: MessageSquare },
  { value: 'ayarlar', label: 'Ayarlar', icon: Settings },
];

export function DetailTabs({
  defaultValue = 'dashboard',
  dashboard,
  ayarlar,
  uyeler,
  gorevler,
  toplantilar,
  telegram,
  finans,
}: DetailTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const section = searchParams.get('section') ?? defaultValue;
  const activeSection = TABS.find((t) => t.value === section)
    ? section
    : (TABS[0]?.value ?? defaultValue);

  const panes: Record<string, React.ReactNode> = {
    dashboard,
    finans,
    ayarlar,
    uyeler,
    gorevler,
    toplantilar,
    telegram,
  };

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeSection} onValueChange={handleTabChange} className="gap-5">
      <TabsList className="h-auto w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="gap-1.5 transition-all duration-200 hover:scale-[1.04] hover:-translate-y-px data-[state=inactive]:hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              <span>{t.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-0">
          {panes[t.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
