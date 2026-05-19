import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient, PermissionAction, UserRole } from '@ticketbot/database';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionAction[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Yetkilendirme bilgisi yok');
    }

    if (user.systemRole === UserRole.SYSTEM_ADMIN) return true;

    const params = (request.params ?? {}) as Record<string, string>;
    const associationId = params.associationId ?? params.id;
    if (!associationId) {
      throw new ForbiddenException(
        'Bu işlem için bir dernek bağlamı gerekli (associationId yok)',
      );
    }

    const count = await this.prisma.permission.count({
      where: {
        associationId,
        userId: user.id,
        action: { in: required },
      },
    });

    if (count === 0) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }
    return true;
  }
}
