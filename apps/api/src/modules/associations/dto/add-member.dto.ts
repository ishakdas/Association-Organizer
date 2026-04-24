import { createZodDto } from 'nestjs-zod';
import { addMemberSchema } from '@ticketbot/shared-validation';

export class AddMemberDto extends createZodDto(addMemberSchema) {}
