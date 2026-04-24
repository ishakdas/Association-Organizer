'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Flag,
  Loader2,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import type {
  TaskPriorityValue,
  TaskResponse,
  TaskStatusValue,
} from '@ticketbot/shared-validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useMembers } from '../../_hooks/use-members';
import { useTasks, useUpdateTaskStatus } from '../../_hooks/use-tasks';
import { AddTaskDialog } from './add-task-dialog';

type StatusTab = 'ALL' | TaskStatusValue;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'IN_PROGRESS', label: 'Devam Eden' },
  { value: 'COMPLETED', label: 'Tamamlanan' },
];

const PRIORITY_LABEL: Record<TaskPriorityValue, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
};

// LOW: gri, MEDIUM: mavi (primary/sky), HIGH: kırmızı
const PRIORITY_CLASS: Record<TaskPriorityValue, string> = {
  LOW: 'bg-muted text-muted-foreground border-border',
  MEDIUM: 'bg-primary/10 text-primary border-primary/20',
  HIGH: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_LABEL: Record<TaskStatusValue, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

const STATUS_ICON: Record<TaskStatusValue, typeof Clock> = {
  PENDING: PauseCircle,
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

export function TasksSection({
  associationId,
  canManage,
}: {
  associationId: string;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<StatusTab>('ALL');

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Görevler
          </h2>
        </div>
        {canManage && <AddTaskDialog associationId={associationId} />}
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as StatusTab)}
        className="gap-3"
      >
        <TabsList className="w-fit">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {STATUS_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0">
            <TasksList
              associationId={associationId}
              status={t.value === 'ALL' ? undefined : t.value}
              canManage={canManage}
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function TasksList({
  associationId,
  status,
  canManage,
}: {
  associationId: string;
  status: TaskStatusValue | undefined;
  canManage: boolean;
}) {
  const { data, isLoading, isError, error } = useTasks(associationId, {
    status,
    pageSize: 50,
  });
  const { data: members } = useMembers(associationId);
  const updateStatus = useUpdateTaskStatus(associationId);

  const userById = useMemo(() => {
    const map = new Map<string, { fullName: string; email: string | null }>();
    members?.forEach((m) =>
      map.set(m.user.id, { fullName: m.user.fullName, email: m.user.email }),
    );
    return map;
  }, [members]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        Görevler yüklenemedi: {error.message}
      </p>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-3 text-[13px] text-muted-foreground">
          {status
            ? 'Bu durumda görev yok.'
            : 'Henüz görev oluşturulmamış.'}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {data.data.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          assignee={userById.get(task.assignedToUserId)}
          canManage={canManage}
          onStatusChange={(s) =>
            updateStatus.mutate({ taskId: task.id, status: s })
          }
          isUpdating={
            updateStatus.isPending && updateStatus.variables?.taskId === task.id
          }
        />
      ))}
    </ul>
  );
}

function TaskCard({
  task,
  assignee,
  canManage,
  onStatusChange,
  isUpdating,
}: {
  task: TaskResponse;
  assignee: { fullName: string; email: string | null } | undefined;
  canManage: boolean;
  onStatusChange: (s: TaskStatusValue) => void;
  isUpdating: boolean;
}) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    due !== null &&
    due.getTime() < Date.now() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';
  const StatusIcon = STATUS_ICON[task.status];
  const initials = (assignee?.fullName ?? '??')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="rounded-lg border border-border bg-card transition-colors hover:border-foreground/20">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn('gap-1', PRIORITY_CLASS[task.priority])}
            >
              <Flag className="h-3 w-3" />
              {PRIORITY_LABEL[task.priority]}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[11px]">
              <StatusIcon className="h-3 w-3" />
              {STATUS_LABEL[task.status]}
            </Badge>
            {isOverdue && (
              <Badge
                variant="outline"
                className="gap-1 border-destructive/30 bg-destructive/10 text-[11px] text-destructive"
              >
                <AlertTriangle className="h-3 w-3" />
                Gecikmiş
              </Badge>
            )}
          </div>

          <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">
            {task.title}
          </h3>

          {task.description && (
            <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground">
                {initials}
              </span>
              <span className="text-foreground">
                {assignee?.fullName ?? '—'}
              </span>
            </span>
            {due && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  isOverdue && 'text-destructive',
                )}
              >
                <Clock className="h-3 w-3" />
                {format(due, 'd MMM yyyy', { locale: tr })}
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <div className="shrink-0">
            <Select
              value={task.status}
              onValueChange={(v) => onStatusChange(v as TaskStatusValue)}
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 w-[160px] gap-1 text-[12px]">
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ChevronDown className="h-3 w-3 opacity-60" />
                )}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </li>
  );
}
