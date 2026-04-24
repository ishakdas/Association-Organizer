import { createZodDto } from 'nestjs-zod';
import { createTaskSchema } from '@ticketbot/shared-validation';

export class CreateTaskDto extends createZodDto(createTaskSchema) {}
