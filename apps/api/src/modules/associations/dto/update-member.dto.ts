import { createZodDto } from 'nestjs-zod';
import { updateMemberSchema } from '@ticketbot/shared-validation';

export class UpdateMemberDto extends createZodDto(updateMemberSchema) {}
