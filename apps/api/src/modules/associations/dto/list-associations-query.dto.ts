import { createZodDto } from 'nestjs-zod';
import { listAssociationsQuerySchema } from '@ticketbot/shared-validation';

export class ListAssociationsQueryDto extends createZodDto(listAssociationsQuerySchema) {}
