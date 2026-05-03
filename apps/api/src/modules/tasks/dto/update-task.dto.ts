import { createZodDto } from 'nestjs-zod';
import { updateTaskSchema } from '@ticketbot/shared-validation';

export class UpdateTaskDto extends createZodDto(updateTaskSchema) {}
