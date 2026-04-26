import { createZodDto } from 'nestjs-zod';
import { updateProfileSchema } from '@ticketbot/shared-validation';

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
