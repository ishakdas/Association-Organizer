import { Module } from '@nestjs/common';

// TODO: Implement BullMQ job queues and processors
// Queues to implement:
//   reminder     — sends deadline reminders 24h and 1h before due date
//   extension-sla — auto-escalates unresolved extension requests after SLA
//   notification  — async notification delivery

@Module({})
export class JobsModule {}
