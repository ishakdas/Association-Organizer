import { createZodDto } from 'nestjs-zod';
import { listMyTasksQuerySchema } from '@ticketbot/shared-validation';

export class ListMyTasksQueryDto extends createZodDto(listMyTasksQuerySchema) {}
