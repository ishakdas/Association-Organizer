import { createZodDto } from 'nestjs-zod';
import { grantFinancePermissionSchema } from '@ticketbot/shared-validation';

export class GrantFinancePermissionDto extends createZodDto(grantFinancePermissionSchema) {}
