import { createZodDto } from 'nestjs-zod';
import { createMeetingNoteSchema } from '@ticketbot/shared-validation';

export class CreateMeetingNoteDto extends createZodDto(createMeetingNoteSchema) {}
