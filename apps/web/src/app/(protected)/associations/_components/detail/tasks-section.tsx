'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  Flag,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import type {
  MyTaskItem,
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
import {
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_CLASS,
  TASK_STATUS_ICON,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from '@/lib/task-display';
import { TasksKanban } from '@/app/(protected)/tasks/_components/tasks-kanban';
import { useMembers } from '../../_hooks/use-members';
import { useTasks, useUpdateTaskStatus } from '../../_hooks/use-tasks';
import { AddTaskDialog } from './add-task-dialog';
import { EditTaskDialog } from './edit-task-dialog';
import { ResolveDisputeDialog } from './resolve-dispute-dialog';
import { TaskActivityDialog } from './task-activity-dialog';
import { PrioritizeTasksDialog } from './prioritize-tasks-dialog';

type StatusTab = 'ALL' | TaskStatusValue;
type ViewMode = 'list' | 'kanban';

const VIEW_STORAGE_KEY = 'association-tasks-view';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'IN_PROGRESS', label: 'Devam Eden' },
  { value: 'COMPLETED', label: 'Tamamlanan' },
  { value: 'CANCELLED', label: 'İptal' },
];

export function TasksSection({
  associationId,
  canManage,
  currentUserId,
}: {
  associationId: string;
  canManage: boolean;
  currentUserId?: string;
}) {
  const [tab, setTab] = useState<StatusTab>('ALL');
  const [view, setView] = useState<ViewMode>('kanban');

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'kanban' || saved === 'list') setView(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  // Kanban requires all tasks at once; list can filter by status per-tab.
  const allTasks = useTasks(associationId, { pageSize: 100 });
  const updateStatus = useUpdateTaskStatus(associationId);
  const { data: members } = useMembers(associationId);

  const userById = useMemo(() => {
    const map = new Map<string, { fullName: string; email: string | null }>();
    members?.forEach((m) =>
      map.set(m.user.id, { fullName: m.user.fullName, email: m.user.email }),
    );
    return map;
  }, [members]);

  // Adapt TaskResponse[] to MyTaskItem[] so TasksKanban can be reused.
  const kanbanTasks = useMemo<MyTaskItem[]>(() => {
    if (!allTasks.data) return [];
    return allTasks.data.data.map((t) => ({
      ...t,
      association: { id: associationId, name: '' },
      assignee: {
        id: t.assignedToUserId,
        fullName: userById.get(t.assignedToUserId)?.fullName ?? '—',
      },
    }));
  }, [allTasks.data, associationId, userById]);

  const pendingTaskId = updateStatus.isPending
    ? updateStatus.variables?.taskId
    : undefined;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Görevler
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={setView} />
          {canManage && <PrioritizeTasksDialog associationId={associationId} />}
          {canManage && <AddTaskDialog associationId={associationId} />}
        </div>
      </header>

      {view === 'kanban' ? (
        <TasksKanban
          isLoading={allTasks.isLoading}
          isError={allTasks.isError}
          errorMessage={allTasks.error?.message}
          tasks={kanbanTasks}
          showAssociation={false}
          onStatusChange={(taskId, status) =>
            updateStatus.mutate({ taskId, status })
          }
          pendingTaskId={pendingTaskId}
        />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as StatusTab)}
          className="gap-3"
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
              <TasksList
                associationId={associationId}
                status={t.value === 'ALL' ? undefined : t.value}
                canManage={canManage}
                userById={userById}
                currentUserId={currentUserId}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </section>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Görünüm"
      className="inline-flex h-8 items-center rounded-md border border-border bg-card p-0.5 text-sm"
    >
      <button
        role="tab"
        aria-selected={value === 'list'}
        onClick={() => onChange('list')}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-[12px] font-medium transition-colors',
          value === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <List className="h-3 w-3" />
        Liste
      </button>
      <button
        role="tab"
        aria-selected={value === 'kanban'}
        onClick={() => onChange('kanban')}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-[12px] font-medium transition-colors',
          value === 'kanban'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3 w-3" />
        Pano
      </button>
    </div>
  );
}

function TasksList({
  associationId,
  status,
  canManage,
  userById,
  currentUserId,
}: {
  associationId: string;
  status: TaskStatusValue | undefined;
  canManage: boolean;
  userById: Map<string, { fullName: string; email: string | null }>;
  currentUserId?: string;
}) {
  const { data, isLoading, isError, error } = useTasks(associationId, {
    status,
    pageSize: 50,
  });
  const updateStatus = useUpdateTaskStatus(associationId);

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
          {status ? 'Bu durumda görev yok.' : 'Henüz görev oluşturulmamış.'}
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
          associationId={associationId}
          canManage={canManage}
          currentUserId={currentUserId}
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
  associationId,
  canManage,
  currentUserId,
  onStatusChange,
  isUpdating,
}: {
  task: TaskResponse;
  assignee: { fullName: string; email: string | null } | undefined;
  associationId: string;
  canManage: boolean;
  currentUserId?: string;
  onStatusChange: (s: TaskStatusValue) => void;
  isUpdating: boolean;
}) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    due !== null &&
    due.getTime() < Date.now() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';
  const StatusIcon = TASK_STATUS_ICON[task.status];
  const initials = (assignee?.fullName ?? '??')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [editOpen, setEditOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  // Backend ayrıca üyenin kendi görevinin durumunu değiştirmesine izin
  // veriyor (member-only dernekte). UI'yı buna hizalıyoruz: assignee veya
  // canManage olan kişi statüyü güncelleyebilir.
  const isAssignee = !!currentUserId && currentUserId === task.assignedToUserId;
  const canChangeStatus = canManage || isAssignee;
  const isClosed = task.status === 'COMPLETED' || task.status === 'CANCELLED';
  const reminderActive =
    task.reminderFrequency !== 'NONE' && !isClosed && !!task.reminderAt;
  const reminderLabel = REMINDER_FREQ_LABEL[task.reminderFrequency];

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
            {task.disputed && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-300 bg-amber-50 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <ShieldAlert className="h-3 w-3" />
                İtiraz edildi
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

          {task.disputed && canManage && (
            <div className="flex flex-wrap items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                <span className="font-semibold">{assignee?.fullName ?? 'Atanan kişi'}</span>{' '}
                bu görevin kendisine ait olmadığını söyledi. Yeni atayanı seçin.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 text-[11px]"
                onClick={() => setDisputeOpen(true)}
              >
                İtirazı çöz
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground">
                {initials}
              </span>
              <span>
                Atanan:{' '}
                <span className="text-foreground">
                  {assignee?.fullName ?? '—'}
                </span>
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
            {reminderActive && task.reminderAt && (
              <span className="inline-flex items-center gap-1.5" title={`Sıklık: ${reminderLabel}`}>
                <Bell className="h-3 w-3" />
                <span>
                  Hatırlatma:{' '}
                  <span className="text-foreground">
                    {format(new Date(task.reminderAt), 'd MMM HH:mm', { locale: tr })}
                  </span>
                  {task.reminderFrequency !== 'ONCE' && (
                    <span className="text-muted-foreground"> · {reminderLabel}</span>
                  )}
                </span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <UserPlus className="h-3 w-3" />
              <span>
                Oluşturan: {task.assignedBy.fullName} ·{' '}
                {format(new Date(task.createdAt), 'd MMM yyyy', { locale: tr })}
              </span>
            </span>
            <TaskActivityDialog
              associationId={associationId}
              taskId={task.id}
              taskTitle={task.title}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {canChangeStatus && (
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
          )}
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              Düzenle
            </Button>
          )}
        </div>
      </div>

      {canManage && (
        <>
          <EditTaskDialog
            associationId={associationId}
            task={task}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          {task.disputed && (
            <ResolveDisputeDialog
              associationId={associationId}
              task={task}
              currentAssigneeName={assignee?.fullName}
              open={disputeOpen}
              onOpenChange={setDisputeOpen}
            />
          )}
        </>
      )}
    </li>
  );
}

const REMINDER_FREQ_LABEL: Record<TaskResponse['reminderFrequency'], string> = {
  NONE: 'Yok',
  ONCE: 'Bir kez',
  DAILY: 'Günlük',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
};
