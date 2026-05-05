'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  History,
  Pencil,
  Plus,
  RotateCw,
  Send,
  ShieldAlert,
  ShieldCheck,
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
  DESCRIPTION_CHANGED: FileText,
  TITLE_CHANGED: Pencil,
  REMINDER_CHANGED: Bell,
  REMINDER_SENT: Bell,
  ASSIGNED_NOTIFIED: Send,
  ASSIGNMENT_ACCEPTED: ShieldCheck,
  REASSIGNMENT_REQUESTED: ShieldAlert,
  REASSIGNMENT_RESOLVED: ShieldCheck,
};

// Ikon dairesinin renk paleti aksiyona göre değişir; metnin anlamına
// görsel bir tutamak verir (yeşil = onay, sarı = dikkat, vs.)
const ACTION_TONE: Record<
  TaskActivityActionValue,
  { ring: string; icon: string }
> = {
  CREATED: {
    ring: 'border-primary/30 bg-primary/10',
    icon: 'text-primary',
  },
  REASSIGNED: {
    ring: 'border-sky-300 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30',
    icon: 'text-sky-700 dark:text-sky-400',
  },
  STATUS_CHANGED: {
    ring: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30',
    icon: 'text-emerald-700 dark:text-emerald-400',
  },
  PRIORITY_CHANGED: {
    ring: 'border-border bg-muted/50',
    icon: 'text-foreground',
  },
  DUE_DATE_CHANGED: {
    ring: 'border-border bg-muted/50',
    icon: 'text-foreground',
  },
  DESCRIPTION_CHANGED: {
    ring: 'border-border bg-muted/50',
    icon: 'text-muted-foreground',
  },
  TITLE_CHANGED: {
    ring: 'border-border bg-muted/50',
    icon: 'text-muted-foreground',
  },
  REMINDER_CHANGED: {
    ring: 'border-border bg-muted/50',
    icon: 'text-muted-foreground',
  },
  REMINDER_SENT: {
    ring: 'border-border bg-muted/50',
    icon: 'text-muted-foreground',
  },
  ASSIGNED_NOTIFIED: {
    ring: 'border-border bg-muted/50',
    icon: 'text-muted-foreground',
  },
  ASSIGNMENT_ACCEPTED: {
    ring: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30',
    icon: 'text-emerald-700 dark:text-emerald-400',
  },
  REASSIGNMENT_REQUESTED: {
    ring: 'border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30',
    icon: 'text-amber-700 dark:text-amber-400',
  },
  REASSIGNMENT_RESOLVED: {
    ring: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30',
    icon: 'text-emerald-700 dark:text-emerald-400',
  },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
};

const REMINDER_FREQUENCY_LABEL: Record<string, string> = {
  NONE: 'Hatırlatma kapalı',
  ONCE: 'Tek seferlik',
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
};

type ActivityVisual = {
  /** Tek satırlık özet — actor adından sonra gelir. */
  summary: string;
  /** Opsiyonel alt satır: ek kontekst (eski/yeni değer, kanal, neden). */
  detail?: string;
  /** Opsiyonel sağa hizalı küçük rozet (örn. "Telegram"). */
  badge?: string;
};

function buildVisual(activity: TaskActivity): ActivityVisual {
  const p = activity.payload as Record<string, unknown>;
  const via = typeof p.via === 'string' ? p.via : null;
  const channel = typeof p.channel === 'string' ? p.channel : null;
  const badge =
    via === 'telegram' || channel === 'telegram' ? 'Telegram' : undefined;

  switch (activity.action) {
    case 'CREATED':
      return { summary: 'Görevi oluşturdu' };

    case 'STATUS_CHANGED': {
      const from = STATUS_LABEL[String(p.from)] ?? String(p.from ?? '—');
      const to = STATUS_LABEL[String(p.to)] ?? String(p.to ?? '—');
      const reason =
        p.reason === 'accepted'
          ? 'Atamayı kabul ettiği için otomatik geçiş'
          : undefined;
      return {
        summary: 'Durumu güncelledi',
        detail: reason ? `${from} → ${to} · ${reason}` : `${from} → ${to}`,
        badge,
      };
    }

    case 'PRIORITY_CHANGED': {
      const from = PRIORITY_LABEL[String(p.from)] ?? String(p.from ?? '—');
      const to = PRIORITY_LABEL[String(p.to)] ?? String(p.to ?? '—');
      return {
        summary: 'Önceliği değiştirdi',
        detail: `${from} → ${to}`,
        badge,
      };
    }

    case 'DUE_DATE_CHANGED': {
      const fromIso = typeof p.from === 'string' ? p.from : null;
      const toIso = typeof p.to === 'string' ? p.to : null;
      const fromLabel = fromIso
        ? format(new Date(fromIso), 'd MMM yyyy HH:mm', { locale: tr })
        : 'belirsiz';
      const toLabel = toIso
        ? format(new Date(toIso), 'd MMM yyyy HH:mm', { locale: tr })
        : 'kaldırıldı';
      return {
        summary: 'Bitiş tarihini güncelledi',
        detail: `${fromLabel} → ${toLabel}`,
        badge,
      };
    }

    case 'TITLE_CHANGED':
      return { summary: 'Başlığı düzenledi', badge };

    case 'DESCRIPTION_CHANGED':
      return { summary: 'Açıklamayı düzenledi', badge };

    case 'REMINDER_CHANGED': {
      const reminderAt =
        typeof p.reminderAt === 'string' ? p.reminderAt : null;
      const freq =
        typeof p.reminderFrequency === 'string'
          ? REMINDER_FREQUENCY_LABEL[p.reminderFrequency] ?? p.reminderFrequency
          : null;
      const parts: string[] = [];
      if (freq) parts.push(freq);
      if (reminderAt) {
        parts.push(
          format(new Date(reminderAt), 'd MMM yyyy HH:mm', { locale: tr }),
        );
      }
      return {
        summary: 'Hatırlatmayı güncelledi',
        detail: parts.length > 0 ? parts.join(' · ') : undefined,
        badge,
      };
    }

    case 'REMINDER_SENT': {
      const kind = p.type === 'DUE' ? 'Bitiş tarihi hatırlatıldı' : 'Hatırlatma gönderildi';
      return { summary: kind, badge };
    }

    case 'ASSIGNED_NOTIFIED': {
      const delivered = p.delivered === true;
      const reason = typeof p.reason === 'string' ? p.reason : null;
      const kind = typeof p.kind === 'string' ? p.kind : null;
      if (kind === 'dispute') {
        return {
          summary: delivered
            ? 'İtiraz takipçiye iletildi'
            : 'İtiraz iletilmek istendi (bildirim ulaşmadı)',
          badge,
        };
      }
      if (delivered) {
        return { summary: 'Atama bildirimi gönderildi', badge };
      }
      if (reason === 'no_telegram') {
        return {
          summary: 'Atama bildirimi gönderilmedi',
          detail: 'Atanan üyenin Telegram hesabı bağlı değil.',
        };
      }
      return {
        summary: 'Atama bildirimi gönderilemedi',
        detail: reason ? `Sebep: ${reason}` : undefined,
        badge,
      };
    }

    case 'ASSIGNMENT_ACCEPTED':
      return { summary: 'Görevi kabul etti', badge };

    case 'REASSIGNMENT_REQUESTED':
      return {
        summary: 'Görev için itiraz gönderdi',
        detail: '"Bu görev bana ait değil" — yeniden atama bekleniyor.',
        badge,
      };

    case 'REASSIGNMENT_RESOLVED':
      return {
        summary: 'İtirazı çözdü, görevi yeniden atadı',
        badge,
      };

    case 'REASSIGNED':
      return { summary: 'Görevi yeniden atadı', badge };

    default:
      // Şemada olmayan ya da ileride eklenecek bir aksiyon ham enum
      // olarak değil, jenerik bir mesajla yansır.
      return { summary: 'İşlem kaydedildi' };
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
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
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
    <ol className="max-h-[60vh] space-y-1 overflow-y-auto py-1 pr-1">
      {data.map((a, idx) => {
        const Icon = ACTION_ICON[a.action] ?? History;
        const tone = ACTION_TONE[a.action] ?? {
          ring: 'border-border bg-muted/50',
          icon: 'text-muted-foreground',
        };
        const visual = buildVisual(a);
        // System-triggered actions (e.g. reminder fan-out) carry an
        // assignee actor for FK reasons but should read as "Sistem".
        const actorLabel =
          a.action === 'REMINDER_SENT' ? 'Sistem' : a.actor.fullName;
        const createdAt = new Date(a.createdAt);
        const relative = formatDistanceToNow(createdAt, {
          addSuffix: true,
          locale: tr,
        });
        const absolute = format(createdAt, 'd MMM yyyy HH:mm', { locale: tr });
        const isLast = idx === data.length - 1;

        return (
          <li key={a.id} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tone.ring}`}
              >
                <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
              </span>
              {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>

            <div className="min-w-0 pb-3 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-[13px] leading-snug text-foreground">
                  <span className="font-medium">{actorLabel}</span>{' '}
                  <span className="text-muted-foreground">·</span>{' '}
                  {visual.summary}
                </p>
                {visual.badge && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {visual.badge}
                  </span>
                )}
              </div>
              {visual.detail && (
                <p className="mt-1 break-words text-[12px] leading-relaxed text-muted-foreground">
                  {visual.detail}
                </p>
              )}
              <p
                className="mt-1 text-[11px] text-muted-foreground"
                title={absolute}
              >
                {relative} <span className="opacity-60">· {absolute}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
