import { createZodDto } from 'nestjs-zod';
import { updateMeetingNoteSchema } from '@ticketbot/shared-validation';

export class UpdateMeetingNoteDto extends createZodDto(updateMeetingNoteSchema) {}
