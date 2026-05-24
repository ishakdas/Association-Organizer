-- pg-boss job-id bookkeeping columns. Nullable so existing rows survive the
-- BullMQ → pg-boss cutover; new schedules populate them.

ALTER TABLE "tasks" ADD COLUMN "dueJobId" TEXT;
ALTER TABLE "tasks" ADD COLUMN "reminderJobId" TEXT;
ALTER TABLE "events" ADD COLUMN "notifyJobId" TEXT;
