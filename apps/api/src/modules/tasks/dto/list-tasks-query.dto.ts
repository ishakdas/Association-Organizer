import { createZodDto } from 'nestjs-zod';
import { listTasksQuerySchema } from '@ticketbot/shared-validation';

export class ListTasksQueryDto extends createZodDto(listTasksQuerySchema) {}
