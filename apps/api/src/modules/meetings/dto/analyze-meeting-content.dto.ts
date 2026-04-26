import { createZodDto } from 'nestjs-zod';
import { analyzeMeetingContentSchema } from '@ticketbot/shared-validation';

export class AnalyzeMeetingContentDto extends createZodDto(analyzeMeetingContentSchema) {}
