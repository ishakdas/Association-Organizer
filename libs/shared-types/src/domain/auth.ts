import type { UserRole } from '../enums';

export interface AuthTokenPayload {
  sub: string; // userId
  email?: string;
}

export interface BotTokenPayload {
  sub: string; // userId
  telegramId: string;
}

export interface TelegramLinkTokenDto {
  token: string;
  expiresAt: string;
}

export interface AuthMembership {
  id: string;
  associationId: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  fullName: string;
  supabaseUserId: string | null;
  memberships: AuthMembership[];
  systemRole: UserRole | null;
}
