import { createZodDto } from 'nestjs-zod';
import { suggestIslamicEventsInputSchema } from '@ticketbot/shared-validation';

export class SuggestIslamicEventsDto extends createZodDto(suggestIslamicEventsInputSchema) {}
