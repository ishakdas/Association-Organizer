import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

/**
 * Placeholder. Original Organisation tenancy was removed; will be rebuilt as
 * `@CurrentAssociation()` once association-scoped endpoints land.
 */
export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return (request as any).associationId;
  },
);
