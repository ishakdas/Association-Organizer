import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@ticketbot/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Role hierarchy: higher index = more privileges
const ROLE_HIERARCHY: Role[] = ['MEMBER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const membership = request.membership;

    if (!membership) {
      throw new ForbiddenException('Membership not resolved');
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(membership.role);
    const minRequiredIndex = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY.indexOf(r)),
    );

    if (userRoleIndex < minRequiredIndex) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
