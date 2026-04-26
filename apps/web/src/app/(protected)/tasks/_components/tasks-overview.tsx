'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  Flag,
  Loader2,
  UserPlus,
} from 'lucide-react';
import type {
  MyTaskItem,
  TaskStatusValue,
} from '@ticketbot/shared-validation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_CLASS,
  TASK_STATUS_ICON,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from '@/lib/task-display';
import {
  useMyTasks,
  useUpdateMyTaskStatus,
} from '../_hooks/use-my-tasks';
import { TaskActivityDialog } from '@/app/(protected)/associations/_components/detail/task-activity-dialog';

const ALL_ASSOC = 'ALL';
type StatusTab = 'ALL' | TaskStatusValue;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'IN_PROGRESS', label: 'Devam Eden' },
  { value: 'COMPLETED', label: 'Tamamlanan' },
  { value: 'CANCELLED', label: 'İptal' },
];

export function TasksOverview() {
  const [associationId, setAssociationId] = useState<string>(ALL_ASSOC);
  const [tab, setTab] = useState<StatusTab>('ALL');

  // Catalog query: pulls everything visible so the association select
  // shows every dernek the user has access to (filters narrow client-side).
  const catalog = useMyTasks({ pageSize: 100 });

  const associations = useMemo(() => {
    const map = new Map<string, string>();
    catalog.data?.data.forEach((t) =>
      map.set(t.association.id, t.association.name),
    );
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'tr'),
    );
  }, [catalog.data]);

  const list = useMyTasks({
    associationId: associationId === ALL_ASSOC ? undefined : associationId,
    status: tab === 'ALL' ? undefined : tab,
    pageSize: 100,
  });

  const updateStatus = useUpdateMyTaskStatus();

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b border-border pb-6">
        <span className="eyebrow">Çalışma alanı</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Görevler</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Yetkili olduğunuz tüm derneklerin görevlerini buradan takip
              edin.
            </p>
          </div>
          <Select value={associationId} onValueChange={setAssociationId}>
            <SelectTrigger className="h-9 w-[240px] text-sm">
              <Building2 className="h-4 w-4 opacity-60" />
              <SelectValue placeholder="Dernek seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ASSOC}>Tüm dernekler</SelectItem>
              {associations.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as StatusTab)}
        className="gap-4"
      >
        <TabsList className="w-fit flex-wrap">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0">
            <TasksBody
              isLoading={list.isLoading}
              isError={list.isError}
              errorMessage={list.error?.message}
              tasks={list.data?.data ?? []}
              groupByAssociation={associationId === ALL_ASSOC}
              onStatusChange={(taskId, status) =>
                updateStatus.mutate({ taskId, status })
              }
              pendingTaskId={
                updateStatus.isPending
                  ? updateStatus.variables?.taskId
                  : undefined
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function TasksBody({
  isLoading,
  isError,
  errorMessage,
  tasks,
  groupByAssociation,
  onStatusChange,
  pendingTaskId,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | undefined;
  tasks: MyTaskItem[];
  groupByAssociation: boolean;
  onStatusChange: (taskId: string, status: TaskStatusValue) => void;
  pendingTaskId: string | undefined;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        Görevler yüklenemedi: {errorMessage}
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-3 text-[13px] text-muted-foreground">
          Bu filtrelerle eşleşen görev yok.
        </p>
      </div>
    );
  }

  if (!groupByAssociation) {
    return (
      <ul className="space-y-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            isUpdating={pendingTaskId === t.id}
            onStatusChange={(s) => onStatusChange(t.id, s)}
          />
        ))}
      </ul>
    );
  }

  // "Tüm dernekler" — kategorize ederek göster.
  const groups = new Map<string, { name: string; tasks: MyTaskItem[] }>();
  for (const t of tasks) {
    const g = groups.get(t.association.id) ?? {
      name: t.association.name,
      tasks: [],
    };
    g.tasks.push(t);
    groups.set(t.association.id, g);
  }
  const ordered = Array.from(groups, ([id, g]) => ({ id, ...g })).sort(
    (a, b) => a.name.localeCompare(b.name, 'tr'),
  );

  return (
    <div className="space-y-6">
      {ordered.map((group) => (
        <div key={group.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <Link
                href={`/associations/${group.id}`}
                className="hover:text-primary hover:underline"
              >
                {group.name}
              </Link>
              <span className="text-[11px] font-normal text-muted-foreground">
                ({group.tasks.length})
              </span>
            </h2>
          </div>
          <ul className="space-y-2">
            {group.tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                isUpdating={pendingTaskId === t.id}
                onStatusChange={(s) => onStatusChange(t.id, s)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  isUpdating,
  onStatusChange,
}: {
  task: MyTaskItem;
  isUpdating: boolean;
  onStatusChange: (status: TaskStatusValue) => void;
}) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    due !== null &&
    due.getTime() < Date.now() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';
  const StatusIcon = TASK_STATUS_ICON[task.status];
  const initials = (task.assignee.fullName || '??')
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
              className={cn('gap-1', TASK_PRIORITY_CLASS[task.priority])}
            >
              <Flag className="h-3 w-3" />
              {TASK_PRIORITY_LABEL[task.priority]}
            </Badge>
            <Badge
              variant="outline"
              className={cn('gap-1 text-[11px]', TASK_STATUS_CLASS[task.status])}
            >
              <StatusIcon className="h-3 w-3" />
              {TASK_STATUS_LABEL[task.status]}
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
              <span>
                Atanan:{' '}
                <span className="text-foreground">
                  {task.assignee.fullName}
                </span>
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
            <span className="inline-flex items-center gap-1.5">
              <UserPlus className="h-3 w-3" />
              <span>
                Oluşturan: {task.assignedBy.fullName} ·{' '}
                {format(new Date(task.createdAt), 'd MMM yyyy', { locale: tr })}
              </span>
            </span>
            {task.watcher && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">
                <Eye className="h-3 w-3" />
                <span>
                  Takipçi:{' '}
                  <span className="font-medium">{task.watcher.fullName}</span>
                </span>
              </span>
            )}
            <TaskActivityDialog
              associationId={task.association.id}
              taskId={task.id}
              taskTitle={task.title}
            />
          </div>
        </div>

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
              {TASK_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </li>
  );
}
