import { createZodDto } from 'nestjs-zod';
import { listAdminUsersQuerySchema } from '@ticketbot/shared-validation';

export class ListAdminUsersQueryDto extends createZodDto(
  listAdminUsersQuerySchema,
) {}
