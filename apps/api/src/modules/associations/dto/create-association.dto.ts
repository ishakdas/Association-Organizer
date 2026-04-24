import { createZodDto } from 'nestjs-zod';
import { createAssociationSchema } from '@ticketbot/shared-validation';

export class CreateAssociationDto extends createZodDto(createAssociationSchema) {}
