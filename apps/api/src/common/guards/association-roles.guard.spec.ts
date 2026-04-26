import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@ticketbot/database';
import { AssociationRolesGuard } from './association-roles.guard';

function ctxWith({
  user,
  params = { id: 'assoc-1' },
}: {
  user: any;
  params?: Record<string, string>;
}) {
  const request = { user, params };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

describe('AssociationRolesGuard — per-association role check', () => {
  let guard: AssociationRolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [AssociationRolesGuard, { provide: Reflector, useValue: reflector }],
    }).compile();
    guard = moduleRef.get(AssociationRolesGuard);
  });

  it('allows the request when no @AssociationRoles() metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = ctxWith({
      user: { id: 'u', memberships: [], systemRole: null },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows SYSTEM_ADMIN to act on any association (bypass)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_SECRETARY]);
    const ctx = ctxWith({
      user: {
        id: 'u',
        memberships: [],
        systemRole: UserRole.SYSTEM_ADMIN,
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a user whose membership in the route association matches the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ASSOCIATION_MANAGER,
      UserRole.ASSOCIATION_SECRETARY,
    ]);
    const ctx = ctxWith({
      user: {
        id: 'u',
        systemRole: null,
        memberships: [
          {
            id: 'm-1',
            associationId: 'assoc-1',
            role: UserRole.ASSOCIATION_SECRETARY,
            isActive: true,
          },
        ],
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws Forbidden when the user is secretary of a DIFFERENT association', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_SECRETARY]);
    const ctx = ctxWith({
      user: {
        id: 'u',
        systemRole: null,
        memberships: [
          {
            id: 'm-1',
            associationId: 'assoc-OTHER',
            role: UserRole.ASSOCIATION_SECRETARY,
            isActive: true,
          },
        ],
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when the user has the wrong role in the right association', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_MANAGER]);
    const ctx = ctxWith({
      user: {
        id: 'u',
        systemRole: null,
        memberships: [
          {
            id: 'm-1',
            associationId: 'assoc-1',
            role: UserRole.ASSOCIATION_MEMBER,
            isActive: true,
          },
        ],
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when no associationId is present on the route (misconfiguration)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_MANAGER]);
    const ctx = ctxWith({
      user: { id: 'u', systemRole: null, memberships: [] },
      params: {},
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('reads associationId from the :associationId param when present (instead of :id)', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_SECRETARY]);
    const ctx = ctxWith({
      user: {
        id: 'u',
        systemRole: null,
        memberships: [
          {
            id: 'm-1',
            associationId: 'assoc-XYZ',
            role: UserRole.ASSOCIATION_SECRETARY,
            isActive: true,
          },
        ],
      },
      params: { associationId: 'assoc-XYZ' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
