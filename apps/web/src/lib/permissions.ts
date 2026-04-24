import type {
  AuthenticatedUser,
  AuthMembership,
  UserRole,
} from '@ticketbot/shared-types';

/**
 * Visibility rule for a navigation item or route.
 *
 * - `auth`: any signed-in user
 * - `member`: user must have at least one active membership
 * - `system_admin`: user must be a SYSTEM_ADMIN
 */
export type RouteAccess = 'auth' | 'member' | 'system_admin';

export function isSystemAdmin(user: AuthenticatedUser | null): boolean {
  return user?.systemRole === 'SYSTEM_ADMIN';
}

export function activeMemberships(
  user: AuthenticatedUser | null,
): AuthMembership[] {
  if (!user) return [];
  return user.memberships.filter((m) => m.isActive);
}

export function hasAnyMembership(user: AuthenticatedUser | null): boolean {
  return activeMemberships(user).length > 0;
}

export function hasRoleInAssociation(
  user: AuthenticatedUser | null,
  associationId: string,
  roles: readonly UserRole[],
): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return activeMemberships(user).some(
    (m) => m.associationId === associationId && roles.includes(m.role),
  );
}

export function canAccessRoute(
  user: AuthenticatedUser | null,
  access: RouteAccess,
): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  switch (access) {
    case 'auth':
      return true;
    case 'member':
      return hasAnyMembership(user);
    case 'system_admin':
      return false;
  }
}

export interface NavItemDef<T = unknown> {
  href: string;
  access: RouteAccess;
  meta?: T;
}

export function filterNav<T>(
  items: readonly NavItemDef<T>[],
  user: AuthenticatedUser | null,
): NavItemDef<T>[] {
  return items.filter((item) => canAccessRoute(user, item.access));
}

/**
 * Surface label for the user's highest active role. Used by the role
 * badge in the user menu — `null` for users with no active memberships
 * (e.g. just-signed-up).
 */
export function userRoleLabel(user: AuthenticatedUser | null): string | null {
  if (!user) return null;
  if (isSystemAdmin(user)) return 'Sistem Yöneticisi';
  const roles = activeMemberships(user).map((m) => m.role);
  if (roles.includes('ASSOCIATION_MANAGER')) return 'Başkan';
  if (roles.includes('ASSOCIATION_SECRETARY')) return 'Sekreter';
  if (roles.includes('ASSOCIATION_MEMBER')) return 'Üye';
  return null;
}
