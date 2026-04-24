import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { UserRole } from '@ticketbot/database';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import {
  TEST_BEARER_TOKEN,
  TEST_USER_EMAIL,
  TEST_USER_FULL_NAME,
  TEST_USER_ID,
  TEST_SUPABASE_ID,
  TEST_ROOT_ASSOCIATION_ID,
  TEST_NON_ADMIN_BEARER_TOKEN,
  TEST_NON_ADMIN_USER_ID,
  TEST_NON_ADMIN_EMAIL,
  TEST_NON_ADMIN_FULL_NAME,
  TEST_NON_ADMIN_SUPABASE_ID,
} from './test-user';

const ADMIN_USER: AuthenticatedUser = {
  id: TEST_USER_ID,
  email: TEST_USER_EMAIL,
  fullName: TEST_USER_FULL_NAME,
  supabaseUserId: TEST_SUPABASE_ID,
  memberships: [
    {
      id: 'ckv00000testrootmembership001',
      associationId: TEST_ROOT_ASSOCIATION_ID,
      role: UserRole.SYSTEM_ADMIN,
      isActive: true,
    },
  ],
  systemRole: UserRole.SYSTEM_ADMIN,
  telegramAccount: null,
};

const NON_ADMIN_USER: AuthenticatedUser = {
  id: TEST_NON_ADMIN_USER_ID,
  email: TEST_NON_ADMIN_EMAIL,
  fullName: TEST_NON_ADMIN_FULL_NAME,
  supabaseUserId: TEST_NON_ADMIN_SUPABASE_ID,
  memberships: [],
  systemRole: null,
  telegramAccount: null,
};

@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<FastifyRequest & {
      user?: unknown;
      tokenKind?: 'supabase' | 'bot';
    }>();

    const header = req.headers?.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    if (token === TEST_BEARER_TOKEN) {
      req.user = ADMIN_USER;
    } else if (token === TEST_NON_ADMIN_BEARER_TOKEN) {
      req.user = NON_ADMIN_USER;
    } else {
      throw new UnauthorizedException('Invalid bearer token');
    }
    req.tokenKind = 'supabase';
    return true;
  }
}
