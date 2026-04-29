import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { AssociationsService } from './associations.service';
import { AssociationsRepository } from './associations.repository';
import { UsersService } from '../users/users.service';

type RepoMock = DeepMockProxy<AssociationsRepository>;
type PrismaMock = DeepMockProxy<PrismaClient>;
type UsersMock = DeepMockProxy<UsersService>;

const sampleAssociation = {
  id: 'assoc-1',
  name: 'Test Derneği',
  shortName: null,
  taxNumber: '1234567890',
  foundedAt: new Date('2020-01-01T00:00:00.000Z'),
  address: 'Test Mah. No:1',
  city: 'Ankara',
  district: 'Çankaya',
  phone: '+905551112233',
  email: 'test@dernek.org',
  website: null,
  logoUrl: null,
  activityArea: 'Eğitim',
  memberCount: 10,
  isActive: true,
  notes: null,
  createdById: 'admin-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

const sampleManagerUser = {
  id: 'user-mgr-1',
  supabaseUserId: '11111111-2222-3333-4444-555555555555',
  email: 'baskan@ornek.test',
  fullName: 'Mehmet Başkan',
  phone: '+905554445566',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

const validInput = {
  name: 'Test Derneği',
  taxNumber: '1234567890',
  foundedAt: '2020-01-01T00:00:00.000Z',
  address: 'Test Mah. No:1',
  city: 'Ankara',
  district: 'Çankaya',
  phone: '+905551112233',
  email: 'test@dernek.org',
  activityArea: 'Eğitim',
  memberCount: 10,
  isActive: true,
  manager: {
    fullName: 'Mehmet Başkan',
    email: 'baskan@ornek.test',
    password: 'super-strong-pass',
    phone: '+905554445566',
  },
};

describe('AssociationsService', () => {
  let service: AssociationsService;
  let repo: RepoMock;
  let prisma: PrismaMock;
  let users: UsersMock;

  beforeEach(async () => {
    repo = mockDeep<AssociationsRepository>();
    prisma = mockDeep<PrismaClient>();
    users = mockDeep<UsersService>();

    // Default: $transaction passes the same mock client through to the callback.
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssociationsService,
        { provide: AssociationsRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    service = moduleRef.get(AssociationsService);
  });

  describe('create — manager-aware saga', () => {
    it('throws ConflictException when taxNumber already exists (no Supabase work yet)', async () => {
      repo.existsByTaxNumber.mockResolvedValue(true);

      await expect(service.create(validInput, 'admin-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.createSupabaseUser).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('happy path: creates Supabase user, association, and a MANAGER membership atomically', async () => {
      repo.existsByTaxNumber.mockResolvedValue(false);
      users.createSupabaseUser.mockResolvedValue(sampleManagerUser as never);
      prisma.association.create.mockResolvedValue(sampleAssociation as never);
      prisma.associationMembership.create.mockResolvedValue({
        id: 'mem-1',
        userId: sampleManagerUser.id,
        associationId: sampleAssociation.id,
        role: 'ASSOCIATION_MANAGER',
      } as never);

      const result = await service.create(validInput, 'admin-1');

      expect(users.createSupabaseUser).toHaveBeenCalledWith({
        email: 'baskan@ornek.test',
        password: 'super-strong-pass',
        fullName: 'Mehmet Başkan',
        phone: '+905554445566',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(prisma.association.create).toHaveBeenCalledTimes(1);
      const createArg = prisma.association.create.mock.calls[0][0];
      expect(createArg.data).toMatchObject({
        name: 'Test Derneği',
        taxNumber: '1234567890',
        createdById: 'admin-1',
      });
      expect((createArg.data as any).foundedAt).toBeInstanceOf(Date);

      expect(prisma.associationMembership.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-mgr-1',
          associationId: 'assoc-1',
          role: 'ASSOCIATION_MANAGER',
          isActive: true,
        }),
      });

      expect(users.deleteUser).not.toHaveBeenCalled();
      expect(result).toEqual(sampleAssociation);
    });

    it('rolls back the Supabase user when association.create fails', async () => {
      repo.existsByTaxNumber.mockResolvedValue(false);
      users.createSupabaseUser.mockResolvedValue(sampleManagerUser as never);
      prisma.association.create.mockRejectedValue(new Error('DB exploded'));

      await expect(service.create(validInput, 'admin-1')).rejects.toThrow(
        'DB exploded',
      );

      expect(users.deleteUser).toHaveBeenCalledWith({
        id: sampleManagerUser.id,
        supabaseUserId: sampleManagerUser.supabaseUserId,
      });
      expect(prisma.associationMembership.create).not.toHaveBeenCalled();
    });

    it('rolls back the Supabase user when membership.create fails (post-association)', async () => {
      repo.existsByTaxNumber.mockResolvedValue(false);
      users.createSupabaseUser.mockResolvedValue(sampleManagerUser as never);
      prisma.association.create.mockResolvedValue(sampleAssociation as never);
      prisma.associationMembership.create.mockRejectedValue(
        new Error('Membership constraint violated'),
      );

      await expect(service.create(validInput, 'admin-1')).rejects.toThrow(
        'Membership constraint violated',
      );

      // Prisma's $transaction handles the DB-side rollback; the saga owns
      // the Supabase + local-user side.
      expect(users.deleteUser).toHaveBeenCalledWith({
        id: sampleManagerUser.id,
        supabaseUserId: sampleManagerUser.supabaseUserId,
      });
    });

    it('does NOT call deleteUser when Supabase user creation itself fails (nothing to roll back)', async () => {
      repo.existsByTaxNumber.mockResolvedValue(false);
      users.createSupabaseUser.mockRejectedValue(
        new ConflictException('Supabase email taken'),
      );

      await expect(service.create(validInput, 'admin-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(users.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the association when found', async () => {
      repo.findById.mockResolvedValue(sampleAssociation as never);

      const result = await service.findOne('assoc-1');

      expect(repo.findById).toHaveBeenCalledWith('assoc-1');
      expect(result).toEqual(sampleAssociation);
    });

    it('throws NotFoundException when the record is missing', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('list — scoped by AuthenticatedUser', () => {
    const adminUser = {
      id: 'admin-1',
      systemRole: 'SYSTEM_ADMIN',
      memberships: [],
    } as any;
    const managerUser = {
      id: 'user-mgr-1',
      systemRole: null,
      memberships: [
        {
          id: 'm-1',
          associationId: 'assoc-1',
          role: 'ASSOCIATION_MANAGER',
          isActive: true,
        },
      ],
    } as any;

    it('SYSTEM_ADMIN: passes the unscoped query through to the repo', async () => {
      repo.findMany.mockResolvedValue({
        data: [sampleAssociation] as never,
        total: 1,
      });

      await service.list({ page: 1, pageSize: 20 } as never, adminUser);

      const arg = repo.findMany.mock.calls[0][0] as any;
      expect(arg).toMatchObject({ page: 1, pageSize: 20 });
      expect(arg.scopedToUserId).toBeUndefined();
    });

    it('non-admin: forwards user.id as scopedToUserId so the repo restricts the where-clause', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 0 });

      await service.list({ page: 1, pageSize: 20 } as never, managerUser);

      const arg = repo.findMany.mock.calls[0][0] as any;
      expect(arg.scopedToUserId).toBe('user-mgr-1');
    });

    it('returns totalPages = ceil(total / pageSize)', async () => {
      repo.findMany.mockResolvedValue({
        data: [sampleAssociation] as never,
        total: 42,
      });

      const result = await service.list(
        { page: 2, pageSize: 10 } as never,
        adminUser,
      );

      expect(result.meta).toEqual({
        total: 42,
        page: 2,
        pageSize: 10,
        totalPages: 5,
      });
    });

    it('returns totalPages = 1 when total is 0', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 0 });

      const result = await service.list(
        { page: 1, pageSize: 20 } as never,
        adminUser,
      );

      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('getGlobalStats', () => {
    it('should return aggregated stats', async () => {
      const mockResult = [
        5,    // totalBranches
        4,    // activeBranches
        23,   // totalMembers
        2,    // pendingRegistrations
        [
          { city: 'İstanbul', _count: { city: 3 } },
          { city: 'Ankara', _count: { city: 2 } },
        ],
      ];
      jest.spyOn(prisma, '$transaction').mockResolvedValueOnce(mockResult as any);

      const result = await service.getGlobalStats();

      expect(result).toEqual({
        totalBranches: 5,
        activeBranches: 4,
        inactiveBranches: 1,
        totalMembers: 23,
        pendingRegistrations: 2,
        cityDistribution: [
          { city: 'İstanbul', count: 3 },
          { city: 'Ankara', count: 2 },
        ],
      });
    });
  });
});
