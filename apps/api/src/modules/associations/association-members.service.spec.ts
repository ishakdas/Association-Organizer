// jose v6 is ESM-only and ts-jest can't transform it. AuthService imports
// jose; this spec only uses AuthService as a DI token (mock injected via
// `useValue`), so an empty stub keeps Jest's CJS runtime happy.
jest.mock('jose', () => ({}));

import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, PrismaService, Prisma } from '@ticketbot/database';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { AssociationMembersService } from './association-members.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

const SYSTEM_ADMIN_ACTOR: AuthenticatedUser = {
  id: 'sysadmin-1',
  email: 'admin@example.com',
  fullName: 'Sistem Yöneticisi',
  supabaseUserId: 'sup-sysadmin',
  systemRole: 'SYSTEM_ADMIN',
  memberships: [],
  telegramAccount: null,
  onboardingCompletedAt: null,
  mustChangePassword: false,
};

const MANAGER_ACTOR: AuthenticatedUser = {
  id: 'manager-1',
  email: 'baskan@example.com',
  fullName: 'Dernek Başkanı',
  supabaseUserId: 'sup-manager',
  systemRole: null,
  memberships: [
    {
      id: 'mem-actor-1',
      associationId: 'assoc-1',
      role: 'ASSOCIATION_MANAGER',
      isActive: true,
    },
  ],
  telegramAccount: null,
  onboardingCompletedAt: null,
  mustChangePassword: false,
};

type PrismaMock = DeepMockProxy<PrismaClient>;
type UsersMock = jest.Mocked<Pick<UsersService, 'createSupabaseUser' | 'createDbOnlyUser' | 'deleteUser'>>;
type AuthMock = jest.Mocked<Pick<AuthService, 'generateLinkToken'>>;

const sampleUser = {
  id: 'user-1',
  supabaseUserId: null,
  email: 'ali@dernek.local',
  fullName: 'Ali Veli',
  phone: '+905551112233',
  isActive: true,
  createdAt: new Date('2026-04-24T00:00:00.000Z'),
  updatedAt: new Date('2026-04-24T00:00:00.000Z'),
  deletedAt: null,
};

const sampleAssociation = {
  id: 'assoc-1',
  name: 'Test Derneği',
  deletedAt: null,
};

const sampleMembership = {
  id: 'mem-1',
  userId: sampleUser.id,
  associationId: sampleAssociation.id,
  role: 'ASSOCIATION_MEMBER' as const,
  titleId: null,
  customTitle: null,
  joinedAt: new Date('2026-04-24T00:00:00.000Z'),
  leftAt: null,
  isActive: true,
  deletedAt: null,
  user: {
    id: sampleUser.id,
    fullName: sampleUser.fullName,
    email: sampleUser.email,
    phone: sampleUser.phone,
  },
  title: null,
};

const validInput = {
  fullName: 'Ali Veli',
  email: 'ali@dernek.local',
  phone: '+905551112233',
  role: 'ASSOCIATION_MEMBER' as const,
};

describe('AssociationMembersService', () => {
  let service: AssociationMembersService;
  let prisma: PrismaMock;
  let users: UsersMock;
  let auth: AuthMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    users = {
      createSupabaseUser: jest.fn(),
      createDbOnlyUser: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as UsersMock;
    auth = {
      generateLinkToken: jest.fn(),
    } as unknown as AuthMock;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssociationMembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();

    service = moduleRef.get(AssociationMembersService);
  });

  describe('create', () => {
    it('throws NotFoundException when the parent association does not exist', async () => {
      prisma.association.findFirst.mockResolvedValue(null);

      await expect(service.create('missing', validInput)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(users.createDbOnlyUser).not.toHaveBeenCalled();
      expect(prisma.associationMembership.create).not.toHaveBeenCalled();
    });

    it('creates a DB-only user + membership for ASSOCIATION_MEMBER', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      users.createDbOnlyUser.mockResolvedValue(sampleUser as never);
      prisma.associationMembership.create.mockResolvedValue(
        sampleMembership as never,
      );

      const result = await service.create(sampleAssociation.id, validInput);

      expect(users.createDbOnlyUser).toHaveBeenCalledWith({
        fullName: 'Ali Veli',
        email: 'ali@dernek.local',
        phone: '+905551112233',
      });
      expect(users.createSupabaseUser).not.toHaveBeenCalled();
      expect(prisma.associationMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          associationId: sampleAssociation.id,
          userId: sampleUser.id,
          role: 'ASSOCIATION_MEMBER',
          isActive: true,
        }),
        include: { user: true, title: true },
      });
      expect(result).toEqual(sampleMembership);
    });

    it('provisions Supabase auth user when role=SECRETARY with password', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      const supaUser = { ...sampleUser, supabaseUserId: 'sup-123' };
      users.createSupabaseUser.mockResolvedValue(supaUser as never);
      prisma.associationMembership.create.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_SECRETARY',
      } as never);

      await service.create(sampleAssociation.id, {
        ...validInput,
        role: 'ASSOCIATION_SECRETARY',
        password: 'super-strong-pass',
      });

      expect(users.createSupabaseUser).toHaveBeenCalledWith({
        email: 'ali@dernek.local',
        password: 'super-strong-pass',
        fullName: 'Ali Veli',
        phone: '+905551112233',
      });
      expect(users.createDbOnlyUser).not.toHaveBeenCalled();
    });

    it('rolls back the created user when membership insert fails', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      const supaUser = { ...sampleUser, supabaseUserId: 'sup-456' };
      users.createSupabaseUser.mockResolvedValue(supaUser as never);

      const violation = new Prisma.PrismaClientKnownRequestError(
        'one_active_manager_per_association',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['associationId'] } },
      );
      prisma.associationMembership.create.mockRejectedValue(violation);

      await expect(
        service.create(sampleAssociation.id, {
          ...validInput,
          role: 'ASSOCIATION_SECRETARY',
          password: 'super-strong-pass',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(users.deleteUser).toHaveBeenCalledWith({
        id: supaUser.id,
        supabaseUserId: 'sup-456',
      });
    });

    it('translates Prisma P2002 (partial-unique violation) into ConflictException', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      users.createDbOnlyUser.mockResolvedValue(sampleUser as never);

      const violation = new Prisma.PrismaClientKnownRequestError(
        'one_active_manager_per_association',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['associationId'] } },
      );
      prisma.associationMembership.create.mockRejectedValue(violation);

      await expect(
        service.create(sampleAssociation.id, {
          ...validInput,
          role: 'ASSOCIATION_MANAGER',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('list', () => {
    it('defaults to active memberships only and includes user + title', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      prisma.associationMembership.findMany.mockResolvedValue([sampleMembership] as never);

      const result = await service.list(sampleAssociation.id, {});

      expect(prisma.associationMembership.findMany).toHaveBeenCalledWith({
        where: {
          associationId: sampleAssociation.id,
          isActive: true,
          deletedAt: null,
          leftAt: null,
        },
        include: { user: true, title: true },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
      expect(result).toEqual([sampleMembership]);
    });

    it('honors role filter when provided', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      prisma.associationMembership.findMany.mockResolvedValue([] as never);

      await service.list(sampleAssociation.id, { role: 'ASSOCIATION_MANAGER' });

      const args = prisma.associationMembership.findMany.mock.calls[0][0];
      expect(args?.where).toMatchObject({
        associationId: sampleAssociation.id,
        role: 'ASSOCIATION_MANAGER',
      });
    });

    it('returns BOTH active and left when isActive=false (audit view)', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      prisma.associationMembership.findMany.mockResolvedValue([] as never);

      await service.list(sampleAssociation.id, { isActive: false });

      const args = prisma.associationMembership.findMany.mock.calls[0][0];
      expect(args?.where).not.toHaveProperty('isActive');
      expect(args?.where).not.toHaveProperty('leftAt');
      expect(args?.where).toMatchObject({
        associationId: sampleAssociation.id,
        deletedAt: null,
      });
    });

    it('throws NotFoundException when the parent association does not exist', async () => {
      prisma.association.findFirst.mockResolvedValue(null);

      await expect(service.list('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the membership does not exist', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          sampleAssociation.id,
          'missing-mem',
          { role: 'ASSOCIATION_SECRETARY' },
          SYSTEM_ADMIN_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('rejects a membershipId belonging to a different dernek (cross-tenant)', async () => {
      // Simulates Prisma returning null because the narrowed filter
      // `{ id, associationId, deletedAt: null }` does not match when
      // the supplied associationId is foreign to the membership.
      prisma.associationMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'other-assoc',
          sampleMembership.id,
          { role: 'ASSOCIATION_SECRETARY' },
          SYSTEM_ADMIN_ACTOR,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      const args = prisma.associationMembership.findFirst.mock.calls[0][0];
      expect(args?.where).toMatchObject({
        id: sampleMembership.id,
        associationId: 'other-assoc',
        deletedAt: null,
      });
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('updates only provided fields and includes user + title', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(
        sampleMembership as never,
      );
      prisma.associationMembership.update.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_SECRETARY',
      } as never);

      const result = await service.update(
        sampleAssociation.id,
        sampleMembership.id,
        { role: 'ASSOCIATION_SECRETARY' },
        MANAGER_ACTOR,
      );

      expect(prisma.associationMembership.update).toHaveBeenCalledWith({
        where: { id: sampleMembership.id },
        data: { role: 'ASSOCIATION_SECRETARY' },
        include: { user: true, title: true },
      });
      expect(result.role).toBe('ASSOCIATION_SECRETARY');
    });

    it('translates Prisma P2002 into ConflictException on role change', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(
        sampleMembership as never,
      );
      const violation = new Prisma.PrismaClientKnownRequestError(
        'one_active_manager_per_association',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['associationId'] } },
      );
      prisma.associationMembership.update.mockRejectedValue(violation);

      await expect(
        service.update(
          sampleAssociation.id,
          sampleMembership.id,
          { role: 'ASSOCIATION_MANAGER' },
          SYSTEM_ADMIN_ACTOR,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('forbids a non-SYSTEM_ADMIN actor from promoting a member to MANAGER', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(
        sampleMembership as never,
      );

      await expect(
        service.update(
          sampleAssociation.id,
          sampleMembership.id,
          { role: 'ASSOCIATION_MANAGER' },
          MANAGER_ACTOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('forbids a non-SYSTEM_ADMIN actor from demoting an existing MANAGER', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_MANAGER',
      } as never);

      await expect(
        service.update(
          sampleAssociation.id,
          sampleMembership.id,
          { role: 'ASSOCIATION_MEMBER' },
          MANAGER_ACTOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('lets SYSTEM_ADMIN demote an existing MANAGER', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_MANAGER',
      } as never);
      prisma.associationMembership.update.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_MEMBER',
      } as never);

      const result = await service.update(
        sampleAssociation.id,
        sampleMembership.id,
        { role: 'ASSOCIATION_MEMBER' },
        SYSTEM_ADMIN_ACTOR,
      );

      expect(result.role).toBe('ASSOCIATION_MEMBER');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the membership does not exist', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(sampleAssociation.id, 'missing-mem', SYSTEM_ADMIN_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('rejects a membershipId belonging to a different dernek (cross-tenant)', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('other-assoc', sampleMembership.id, SYSTEM_ADMIN_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundException);

      const args = prisma.associationMembership.findFirst.mock.calls[0][0];
      expect(args?.where).toMatchObject({
        id: sampleMembership.id,
        associationId: 'other-assoc',
      });
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('soft-leaves the membership: sets leftAt + isActive=false', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(
        sampleMembership as never,
      );
      prisma.associationMembership.update.mockResolvedValue({
        ...sampleMembership,
        isActive: false,
        leftAt: new Date('2026-04-24T12:00:00.000Z'),
      } as never);

      const result = await service.remove(
        sampleAssociation.id,
        sampleMembership.id,
        MANAGER_ACTOR,
      );

      const args = prisma.associationMembership.update.mock.calls[0][0];
      expect(args?.where).toEqual({ id: sampleMembership.id });
      expect(args?.data).toMatchObject({ isActive: false });
      expect((args?.data as any)?.leftAt).toBeInstanceOf(Date);
      expect(result.isActive).toBe(false);
      expect(result.leftAt).not.toBeNull();
    });

    it('forbids a non-SYSTEM_ADMIN actor from removing a MANAGER membership', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_MANAGER',
      } as never);

      await expect(
        service.remove(
          sampleAssociation.id,
          sampleMembership.id,
          MANAGER_ACTOR,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.associationMembership.update).not.toHaveBeenCalled();
    });

    it('lets SYSTEM_ADMIN remove a MANAGER membership', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_MANAGER',
      } as never);
      prisma.associationMembership.update.mockResolvedValue({
        ...sampleMembership,
        role: 'ASSOCIATION_MANAGER',
        isActive: false,
        leftAt: new Date(),
      } as never);

      const result = await service.remove(
        sampleAssociation.id,
        sampleMembership.id,
        SYSTEM_ADMIN_ACTOR,
      );

      expect(result.isActive).toBe(false);
    });
  });

  describe('create (rollback)', () => {
    it('logs and continues when the Supabase rollback itself fails', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      const supaUser = { ...sampleUser, supabaseUserId: 'sup-rollback' };
      users.createSupabaseUser.mockResolvedValue(supaUser as never);
      users.deleteUser.mockRejectedValueOnce(new Error('Supabase 500'));

      const loggerSpy = jest
        .spyOn(
          (service as unknown as { logger: { error: jest.Mock } }).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      prisma.associationMembership.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'one_active_manager_per_association',
          {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['associationId'] },
          },
        ),
      );

      await expect(
        service.create(sampleAssociation.id, {
          ...validInput,
          role: 'ASSOCIATION_SECRETARY',
          password: 'super-strong-pass',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(users.deleteUser).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Saga rollback failed'),
      );
    });
  });
});
