import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@ticketbot/shared-types';

export const ASSOCIATION_ROLES_KEY = 'associationRoles';

export const AssociationRoles = (...roles: UserRole[]) =>
  SetMetadata(ASSOCIATION_ROLES_KEY, roles);
