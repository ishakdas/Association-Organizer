import { createZodDto } from 'nestjs-zod';
import { grantMeetingPermissionSchema } from '@ticketbot/shared-validation';

export class GrantMeetingPermissionDto extends createZodDto(grantMeetingPermissionSchema) {}
