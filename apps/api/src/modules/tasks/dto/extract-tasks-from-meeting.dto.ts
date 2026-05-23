import { createZodDto } from 'nestjs-zod';
import { extractTasksFromMeetingSchema } from '@ticketbot/shared-validation';

export class ExtractTasksFromMeetingDto extends createZodDto(extractTasksFromMeetingSchema) {}
