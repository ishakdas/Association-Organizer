import { createZodDto } from 'nestjs-zod';
import { analyzeMeetingContentSchema } from '@ticketbot/shared-validation';

export class SuggestAgendaDto extends createZodDto(analyzeMeetingContentSchema) {}