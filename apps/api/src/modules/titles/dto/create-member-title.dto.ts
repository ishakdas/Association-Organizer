import { createZodDto } from 'nestjs-zod';
import { createMemberTitleSchema } from '@ticketbot/shared-validation';

export class CreateMemberTitleDto extends createZodDto(createMemberTitleSchema) {}
