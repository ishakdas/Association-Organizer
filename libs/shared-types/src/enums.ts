// Mirrored from Prisma enums — kept here so web/validation libs don't depend on Prisma.

export const UserRole = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  ASSOCIATION_MANAGER: 'ASSOCIATION_MANAGER',
  ASSOCIATION_SECRETARY: 'ASSOCIATION_SECRETARY',
  ASSOCIATION_MEMBER: 'ASSOCIATION_MEMBER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TaskStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const ReminderFrequency = {
  NONE: 'NONE',
  ONCE: 'ONCE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type ReminderFrequency = (typeof ReminderFrequency)[keyof typeof ReminderFrequency];
