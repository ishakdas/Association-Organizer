'use client';

import {
  BookOpen,
  Briefcase,
  ClipboardList,
  Crown,
  Info,
  Users,
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
  genel: React.ReactNode;
  baskan: React.ReactNode;
  sekreterler: React.ReactNode;
  uyeler: React.ReactNode;
  gorevler: React.ReactNode;
  toplantilar: React.ReactNode;
}

interface TabDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

const TABS: readonly TabDef[] = [
  { value: 'genel', label: 'Genel Bilgiler', icon: Info },
  { value: 'baskan', label: 'Başkan', icon: Crown },
  { value: 'sekreterler', label: 'Sekreterler', icon: Briefcase },
  { value: 'uyeler', label: 'Üyeler', icon: Users },
  { value: 'gorevler', label: 'Görevler', icon: ClipboardList },
  { value: 'toplantilar', label: 'Toplantılar', icon: BookOpen },
];

export function DetailTabs({
  defaultValue = 'genel',
  genel,
  baskan,
  sekreterler,
  uyeler,
  gorevler,
  toplantilar,
}: DetailTabsProps) {
  const panes: Record<string, React.ReactNode> = {
    genel,
    baskan,
    sekreterler,
    uyeler,
    gorevler,
    toplantilar,
  };

  return (
    <Tabs defaultValue={defaultValue} className="gap-5">
      <TabsList className="h-auto w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <Icon className="h-3.5 w-3.5" />
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
