import { createZodDto } from 'nestjs-zod';
import { updateMemberTitleSchema } from '@ticketbot/shared-validation';

export class UpdateMemberTitleDto extends createZodDto(updateMemberTitleSchema) {}
