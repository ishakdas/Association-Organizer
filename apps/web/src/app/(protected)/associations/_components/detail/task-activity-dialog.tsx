'use client';

import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  Flag,
  History,
  Plus,
  RotateCw,
  type LucideIcon,
} from 'lucide-react';
import type {
  TaskActivity,
  TaskActivityActionValue,
} from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaskActivities } from '../../_hooks/use-tasks';

const ACTION_ICON: Record<TaskActivityActionValue, LucideIcon> = {
  CREATED: Plus,
  REASSIGNED: RotateCw,
  STATUS_CHANGED: CheckCircle2,
  PRIORITY_CHANGED: Flag,
  DUE_DATE_CHANGED: Clock,
  DESCRIPTION_CHANGED: History,
  TITLE_CHANGED: History,
  REMINDER_CHANGED: Clock,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

function describe(activity: TaskActivity): string {
  const p = activity.payload as Record<string, unknown>;
  switch (activity.action) {
    case 'CREATED':
      return 'Görevi oluşturdu';
    case 'STATUS_CHANGED': {
      const from = STATUS_LABEL[String(p.from)] ?? String(p.from);
      const to = STATUS_LABEL[String(p.to)] ?? String(p.to);
      const via = p.via === 'telegram' ? ' (Telegram)' : '';
      return `Durumu ${from} → ${to} olarak değiştirdi${via}`;
    }
    case 'DUE_DATE_CHANGED': {
      const to = p.to ? new Date(String(p.to)) : null;
      const via = p.via === 'telegram' ? ' (Telegram)' : '';
      return to
        ? `Bitiş tarihini ${format(to, 'd MMM yyyy', { locale: tr })} olarak güncelledi${via}`
        : `Bitiş tarihini güncelledi${via}`;
    }
    case 'REASSIGNED':
      return 'Görevi yeniden atadı';
    case 'PRIORITY_CHANGED':
      return `Önceliği ${String(p.from ?? '')} → ${String(p.to ?? '')} yaptı`;
    case 'TITLE_CHANGED':
      return 'Başlığı düzenledi';
    case 'DESCRIPTION_CHANGED':
      return 'Açıklamayı düzenledi';
    case 'REMINDER_CHANGED':
      return 'Hatırlatmayı güncelledi';
    default:
      return activity.action;
  }
}

export function TaskActivityDialog({
  associationId,
  taskId,
  taskTitle,
}: {
  associationId: string;
  taskId: string;
  taskTitle: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <History className="h-3 w-3" />
          Geçmiş
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Görev Geçmişi</DialogTitle>
          <DialogDescription className="line-clamp-1">
            {taskTitle}
          </DialogDescription>
        </DialogHeader>
        <ActivityList associationId={associationId} taskId={taskId} />
      </DialogContent>
    </Dialog>
  );
}

function ActivityList({
  associationId,
  taskId,
}: {
  associationId: string;
  taskId: string;
}) {
  const { data, isLoading, isError, error } = useTaskActivities(
    associationId,
    taskId,
  );

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        Geçmiş yüklenemedi: {error.message}
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        Henüz kayıt yok.
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 py-2 pl-5">
      <span className="absolute bottom-2 left-2 top-2 w-px bg-border" />
      {data.map((a) => {
        const Icon = ACTION_ICON[a.action] ?? History;
        return (
          <li key={a.id} className="relative">
            <span className="absolute -left-[14px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
              <Icon className="h-3 w-3 text-muted-foreground" />
            </span>
            <div className="space-y-0.5">
              <p className="text-[13px] leading-snug text-foreground">
                <span className="font-medium">{a.actor.fullName}</span> ·{' '}
                {describe(a)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(a.createdAt), 'd MMM yyyy HH:mm', {
                  locale: tr,
                })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
