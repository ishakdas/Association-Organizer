import { createZodDto } from 'nestjs-zod';
import { associationSettingsSchema } from '@ticketbot/shared-validation';

export class AssociationSettingsDto extends createZodDto(associationSettingsSchema) {}
