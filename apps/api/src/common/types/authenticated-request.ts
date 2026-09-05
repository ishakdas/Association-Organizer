import type { AuthenticatedUser } from '@ticketbot/shared-types';
import type { FastifyRequest } from 'fastify';

export type TokenKind = 'bot' | 'supabase';

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
  tokenKind: TokenKind;
}
