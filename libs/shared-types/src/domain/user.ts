import type { Role } from '../enums';

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipDto {
  id: string;
  role: Role;
  organisationId: string;
  userId: string;
  createdAt: string;
}

export interface TelegramAccountDto {
  id: string;
  telegramId: string; // BigInt serialized as string
  username: string | null;
  firstName: string | null;
  userId: string;
  createdAt: string;
}
