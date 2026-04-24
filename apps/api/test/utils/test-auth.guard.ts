import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  TEST_BEARER_TOKEN,
  TEST_USER_EMAIL,
  TEST_USER_ID,
  TEST_SUPABASE_ID,
} from './test-user';

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
    if (token !== TEST_BEARER_TOKEN) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    req.user = {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      supabaseId: TEST_SUPABASE_ID,
    };
    req.tokenKind = 'supabase';
    return true;
  }
}
