import type { UserRole } from '../enums';

export interface UserDto {
  id: string;
  supabaseUserId: string | null;
  email: string | null;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssociationMembershipDto {
  id: string;
  userId: string;
  associationId: string;
  role: UserRole;
  titleId: string | null;
  customTitle: string | null;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

export interface TelegramAccountDto {
  id: string;
  telegramId: string; // BigInt serialized as string
  username: string | null;
  firstName: string | null;
  userId: string;
  createdAt: string;
}
