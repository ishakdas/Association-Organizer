import { createZodDto } from 'nestjs-zod';
import { listAdminAssociationsQuerySchema } from '@ticketbot/shared-validation';

export class ListAdminAssociationsQueryDto extends createZodDto(
  listAdminAssociationsQuerySchema,
) {}
