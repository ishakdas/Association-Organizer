import { CanActivate, Injectable } from '@nestjs/common';

/**
 * Placeholder guard. Original organisation/Role-based guard was removed when
 * the domain pivoted to associations. Will be rebuilt against
 * AssociationMembership + UserRole once the membership API surface lands.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
