import { createZodDto } from 'nestjs-zod';
import { listMeetingNotesQuerySchema } from '@ticketbot/shared-validation';

export class ListMeetingNotesQueryDto extends createZodDto(
  listMeetingNotesQuerySchema,
) {}
