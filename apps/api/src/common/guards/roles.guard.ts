import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ticketbot/database';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as
      | AuthenticatedUser
      | undefined;
    if (!user) {
      throw new ForbiddenException('Yetkilendirme bilgisi yok');
    }

    if (user.systemRole === UserRole.SYSTEM_ADMIN) return true;

    const ok = user.memberships.some(
      (m) => m.isActive && required.includes(m.role),
    );
    if (!ok) {
      throw new ForbiddenException('Bu işlem için gerekli yetkiniz yok');
    }
    return true;
  }
}
