import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PrismaService, Prisma } from '@ticketbot/database';
import { AssociationMembersService } from './association-members.service';

type PrismaMock = DeepMockProxy<PrismaClient>;

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

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();

    // Default: $transaction passes its callback through with the same mock
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssociationMembersService,
        { provide: PrismaService, useValue: prisma },
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
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.associationMembership.create).not.toHaveBeenCalled();
    });

    it('creates user + membership in a single transaction', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      prisma.user.create.mockResolvedValue(sampleUser as never);
      prisma.associationMembership.create.mockResolvedValue(sampleMembership as never);

      const result = await service.create(sampleAssociation.id, validInput);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: 'Ali Veli',
          email: 'ali@dernek.local',
          phone: '+905551112233',
        }),
      });
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

    it('translates Prisma P2002 (partial-unique violation) into ConflictException', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);
      prisma.user.create.mockResolvedValue(sampleUser as never);

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
});
