import { createZodDto } from 'nestjs-zod';
import { updateAssociationSchema } from '@ticketbot/shared-validation';

export class UpdateAssociationDto extends createZodDto(updateAssociationSchema) {}
