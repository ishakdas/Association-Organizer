'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  Clock,
  Eye,
  Flag,
  GripVertical,
  Loader2,
  UserPlus,
} from 'lucide-react';
import type {
  MyTaskItem,
  TaskStatusValue,
} from '@ticketbot/shared-validation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_CLASS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_CLASS,
  TASK_STATUS_ICON,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
} from '@/lib/task-display';
import { TaskActivityDialog } from '@/app/(protected)/associations/_components/detail/task-activity-dialog';

const DRAG_MIME = 'application/x-task-id';
const DRAG_STATUS_MIME = 'application/x-task-status';

export function TasksKanban({
  isLoading,
  isError,
  errorMessage,
  tasks,
  showAssociation,
  onStatusChange,
  pendingTaskId,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | undefined;
  tasks: MyTaskItem[];
  showAssociation: boolean;
  onStatusChange: (taskId: string, status: TaskStatusValue) => void;
  pendingTaskId: string | undefined;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<TaskStatusValue, MyTaskItem[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  if (isError) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        Görevler yüklenemedi: {errorMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUS_ORDER.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={grouped[status]}
          isLoading={isLoading}
          showAssociation={showAssociation}
          draggingId={draggingId}
          pendingTaskId={pendingTaskId}
          onDragStart={(id) => setDraggingId(id)}
          onDragEnd={() => setDraggingId(null)}
          onDropTask={(taskId, currentStatus) => {
            setDraggingId(null);
            if (currentStatus !== status) onStatusChange(taskId, status);
          }}
        />
      ))}
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  isLoading,
  showAssociation,
  draggingId,
  pendingTaskId,
  onDragStart,
  onDragEnd,
  onDropTask,
}: {
  status: TaskStatusValue;
  tasks: MyTaskItem[];
  isLoading: boolean;
  showAssociation: boolean;
  draggingId: string | null;
  pendingTaskId: string | undefined;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, currentStatus: TaskStatusValue) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const StatusIcon = TASK_STATUS_ICON[status];
  const draggedFromOther =
    draggingId !== null && !tasks.some((t) => t.id === draggingId);

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!isOver) setIsOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsOver(false);
      }}
      onDrop={(e) => {
        const taskId = e.dataTransfer.getData(DRAG_MIME);
        const currentStatus = e.dataTransfer.getData(
          DRAG_STATUS_MIME,
        ) as TaskStatusValue;
        setIsOver(false);
        if (taskId) onDropTask(taskId, currentStatus);
      }}
      className={cn(
        'flex flex-col rounded-lg border bg-muted/30 transition-colors',
        isOver && draggedFromOther
          ? 'border-primary bg-primary/5'
          : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="inline-flex items-center gap-2">
          <span
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md border',
              TASK_STATUS_CLASS[status],
            )}
          >
            <StatusIcon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-[13px] font-semibold tracking-tight">
            {TASK_STATUS_LABEL[status]}
          </h3>
        </div>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 px-3 py-8 text-center text-[12px] text-muted-foreground">
            Görev yok
          </p>
        ) : (
          tasks.map((t) => (
            <KanbanCard
              key={t.id}
              task={t}
              showAssociation={showAssociation}
              isDragging={draggingId === t.id}
              isUpdating={pendingTaskId === t.id}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, t.id);
                e.dataTransfer.setData(DRAG_STATUS_MIME, t.status);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(t.id);
              }}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  showAssociation,
  isDragging,
  isUpdating,
  onDragStart,
  onDragEnd,
}: {
  task: MyTaskItem;
  showAssociation: boolean;
  isDragging: boolean;
  isUpdating: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue =
    due !== null &&
    due.getTime() < Date.now() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';
  const initials = (task.assignee.fullName || '??')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      draggable={!isUpdating}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group rounded-md border border-border bg-card p-2.5 shadow-sm transition-all',
        'hover:border-foreground/20',
        isDragging && 'opacity-40',
        isUpdating ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/70" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              variant="outline"
              className={cn(
                'h-5 gap-1 px-1.5 text-[10px]',
                TASK_PRIORITY_CLASS[task.priority],
              )}
            >
              <Flag className="h-2.5 w-2.5" />
              {TASK_PRIORITY_LABEL[task.priority]}
            </Badge>
            {isOverdue && (
              <Badge
                variant="outline"
                className="h-5 gap-1 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] text-destructive"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Gecikmiş
              </Badge>
            )}
            {isUpdating && (
              <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>

          <h4 className="text-[13px] font-medium leading-snug tracking-tight text-foreground">
            {task.title}
          </h4>

          {showAssociation && (
            <Link
              href={`/associations/${task.association.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline"
            >
              <Building2 className="h-3 w-3" />
              {task.association.name}
            </Link>
          )}

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            <span
              className="inline-flex items-center gap-1"
              title={`Atanan: ${task.assignee.fullName}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[8px] font-semibold text-secondary-foreground">
                {initials}
              </span>
              <span className="max-w-[110px] truncate">
                {task.assignee.fullName}
              </span>
            </span>
            {due && (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  isOverdue && 'text-destructive',
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {format(due, 'd MMM', { locale: tr })}
              </span>
            )}
          </div>

          {task.watcher && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              <Eye className="h-2.5 w-2.5" />
              <span className="font-medium">{task.watcher.fullName}</span>
            </span>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-1 truncate">
              <UserPlus className="h-2.5 w-2.5" />
              <span className="truncate">{task.assignedBy.fullName}</span>
            </span>
            <TaskActivityDialog
              associationId={task.association.id}
              taskId={task.id}
              taskTitle={task.title}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
