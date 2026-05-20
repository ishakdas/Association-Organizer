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

export interface MemberTitleAssignmentDto {
  id: string;
  titleId: string | null;
  customTitle: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  title?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
}

export interface AssociationMembershipDto {
  id: string;
  userId: string;
  associationId: string;
  role: UserRole;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
  titleAssignments: MemberTitleAssignmentDto[];
}

export interface TelegramAccountDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  userId: string;
  createdAt: string;
}
