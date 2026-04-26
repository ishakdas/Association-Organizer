import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ticketbot/database';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { ASSOCIATION_ROLES_KEY } from '../decorators/association-roles.decorator';

@Injectable()
export class AssociationRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ASSOCIATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Yetkilendirme bilgisi yok');
    }

    if (user.systemRole === UserRole.SYSTEM_ADMIN) return true;

    // Prefer explicit `:associationId`; fall back to `:id` for routes mounted
    // directly under /associations/:id/...
    const params = (request.params ?? {}) as Record<string, string>;
    const associationId = params.associationId ?? params.id;
    if (!associationId) {
      throw new ForbiddenException(
        'Bu işlem için bir dernek bağlamı gerekli (associationId yok)',
      );
    }

    const ok = user.memberships.some(
      (m) =>
        m.isActive &&
        m.associationId === associationId &&
        required.includes(m.role),
    );
    if (!ok) {
      throw new ForbiddenException('Bu dernek için gerekli yetkiniz yok');
    }
    return true;
  }
}
