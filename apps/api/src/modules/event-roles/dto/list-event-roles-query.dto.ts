import { createZodDto } from 'nestjs-zod';
import { listEventRolesQuerySchema } from '@ticketbot/shared-validation';

export class ListEventRolesQueryDto extends createZodDto(
  listEventRolesQuerySchema,
) {}
