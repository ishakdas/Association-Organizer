import { createZodDto } from 'nestjs-zod';
import { updateTaskStatusSchema } from '@ticketbot/shared-validation';

export class UpdateTaskStatusDto extends createZodDto(updateTaskStatusSchema) {}
