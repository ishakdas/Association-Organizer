import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Runs AFTER AuthGuard. Rejects bot-issued tokens on endpoints meant for
 * Supabase-authenticated web users only (e.g. the Association registry,
 * where each record is owned by a Supabase user).
 *
 * Reads request.tokenKind set by AuthGuard. Missing kind = misconfiguration.
 */
@Injectable()
export class SupabaseUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const kind = request.tokenKind;

    if (!kind) {
      throw new UnauthorizedException(
        'Authentication context missing — SupabaseUserGuard must run after AuthGuard',
      );
    }

    if (kind !== 'supabase') {
      throw new ForbiddenException('Bu uç yalnızca web oturumu (Supabase) ile erişilebilir');
    }

    return true;
  }
}
