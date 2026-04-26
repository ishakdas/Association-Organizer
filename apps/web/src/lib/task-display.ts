import {
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type {
  TaskPriorityValue,
  TaskStatusValue,
} from '@ticketbot/shared-validation';

export const TASK_PRIORITY_LABEL: Record<TaskPriorityValue, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
};

// LOW: gri (önemsiz), MEDIUM: mavi (primary), HIGH: kırmızı (destructive)
export const TASK_PRIORITY_CLASS: Record<TaskPriorityValue, string> = {
  LOW: 'bg-muted text-muted-foreground border-border',
  MEDIUM: 'bg-primary/10 text-primary border-primary/20',
  HIGH: 'bg-destructive/10 text-destructive border-destructive/20',
};

export const TASK_STATUS_LABEL: Record<TaskStatusValue, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
};

export const TASK_STATUS_ICON: Record<TaskStatusValue, LucideIcon> = {
  PENDING: PauseCircle,
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
};

// PENDING: amber (bekliyor), IN_PROGRESS: mavi (aktif),
// COMPLETED: yeşil (bitti), CANCELLED: gri (kapalı).
export const TASK_STATUS_CLASS: Record<TaskStatusValue, string> = {
  PENDING:
    'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  IN_PROGRESS: 'bg-primary/10 text-primary border-primary/20',
  COMPLETED:
    'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

export const TASK_STATUS_ORDER: readonly TaskStatusValue[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];
