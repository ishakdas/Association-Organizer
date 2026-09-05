import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import type { AuthenticatedRequest } from '../types/authenticated-request';

export type RequestUser = AuthenticatedUser;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
