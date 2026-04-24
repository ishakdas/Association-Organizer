import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@ticketbot/database';
import { RolesGuard } from './roles.guard';

function ctxWith(user: any) {
  const request = { user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

describe('RolesGuard — system-level role check', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard, { provide: Reflector, useValue: reflector }],
    }).compile();
    guard = moduleRef.get(RolesGuard);
  });

  it('allows the request when no @Roles() metadata is set (open route)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = ctxWith({ id: 'u', memberships: [], systemRole: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows SYSTEM_ADMIN regardless of @Roles() metadata', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_MANAGER]);
    const ctx = ctxWith({
      id: 'u',
      memberships: [],
      systemRole: UserRole.SYSTEM_ADMIN,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the user when at least one active membership matches @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ASSOCIATION_MANAGER,
      UserRole.ASSOCIATION_SECRETARY,
    ]);
    const ctx = ctxWith({
      id: 'u',
      systemRole: null,
      memberships: [
        {
          id: 'm-1',
          associationId: 'a-1',
          role: UserRole.ASSOCIATION_SECRETARY,
          isActive: true,
        },
      ],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when no membership matches the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_MANAGER]);
    const ctx = ctxWith({
      id: 'u',
      systemRole: null,
      memberships: [
        {
          id: 'm-1',
          associationId: 'a-1',
          role: UserRole.ASSOCIATION_MEMBER,
          isActive: true,
        },
      ],
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the user has no memberships at all', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ASSOCIATION_SECRETARY]);
    const ctx = ctxWith({ id: 'u', systemRole: null, memberships: [] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
