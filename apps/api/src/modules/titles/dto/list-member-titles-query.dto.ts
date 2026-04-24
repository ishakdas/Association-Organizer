import { createZodDto } from 'nestjs-zod';
import { listMemberTitlesQuerySchema } from '@ticketbot/shared-validation';

export class ListMemberTitlesQueryDto extends createZodDto(
  listMemberTitlesQuerySchema,
) {}
