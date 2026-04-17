import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '@ticketbot/database';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user;

    if (!user) {
      throw new ForbiddenException('Authentication required before tenant resolution');
    }

    const organisationId =
      (request.headers['x-organisation-id'] as string) ||
      (request.params as any)?.organisationId;

    if (!organisationId) {
      throw new BadRequestException('Missing x-organisation-id header');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        organisationId_userId: {
          organisationId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organisation');
    }

    (request as any).organisationId = organisationId;
    (request as any).membership = membership;

    return true;
  }
}
