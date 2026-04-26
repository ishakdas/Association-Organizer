import { createZodDto } from 'nestjs-zod';
import { listMembersQuerySchema } from '@ticketbot/shared-validation';

export class ListMembersQueryDto extends createZodDto(listMembersQuerySchema) {}
