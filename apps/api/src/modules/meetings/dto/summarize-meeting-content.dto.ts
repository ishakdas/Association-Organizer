import { createZodDto } from 'nestjs-zod';
import { analyzeMeetingContentSchema } from '@ticketbot/shared-validation';

export class SummarizeMeetingContentDto extends createZodDto(analyzeMeetingContentSchema) {}