import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { AssociationsRepository } from './associations.repository';

type PrismaMock = DeepMockProxy<PrismaClient>;

const sampleAssociation = {
  id: 'assoc-1',
  name: 'Test Derneği',
  shortName: null,
  taxNumber: '1234567890',
  foundedAt: new Date('2020-01-01'),
  address: 'Test Mah. No:1',
  city: 'Ankara',
  district: 'Çankaya',
  phone: '+905551112233',
  email: 'test@dernek.org',
  website: null,
  logoUrl: null,
  activityArea: 'Eğitim',
  presidentName: 'Ahmet Yılmaz',
  memberCount: 10,
  isActive: true,
  notes: null,
  createdById: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

describe('AssociationsRepository', () => {
  let repository: AssociationsRepository;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssociationsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = moduleRef.get(AssociationsRepository);
  });

  describe('create', () => {
    it('calls prisma.association.create with the given data and no soft-delete filter', async () => {
      prisma.association.create.mockResolvedValue(sampleAssociation as never);

      const input = {
        name: 'Test Derneği',
        taxNumber: '1234567890',
        foundedAt: new Date('2020-01-01'),
        address: 'Test Mah. No:1',
        city: 'Ankara',
        district: 'Çankaya',
        phone: '+905551112233',
        email: 'test@dernek.org',
        activityArea: 'Eğitim',
        presidentName: 'Ahmet Yılmaz',
        memberCount: 10,
        isActive: true,
        createdById: 'user-1',
      };

      const result = await repository.create(input);

      expect(prisma.association.create).toHaveBeenCalledTimes(1);
      expect(prisma.association.create).toHaveBeenCalledWith({ data: input });
      expect(result).toEqual(sampleAssociation);
    });
  });

  describe('findById', () => {
    it('filters by id and deletedAt: null', async () => {
      prisma.association.findFirst.mockResolvedValue(sampleAssociation as never);

      const result = await repository.findById('assoc-1');

      expect(prisma.association.findFirst).toHaveBeenCalledWith({
        where: { id: 'assoc-1', deletedAt: null },
      });
      expect(result).toEqual(sampleAssociation);
    });

    it('returns null when no record is found', async () => {
      prisma.association.findFirst.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('applies deletedAt: null and paginates with skip/take', async () => {
      prisma.$transaction.mockResolvedValue([[sampleAssociation], 1] as never);

      const result = await repository.findMany({ page: 2, pageSize: 10 });

      expect(prisma.association.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.association.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: [sampleAssociation], total: 1 });
    });

    it('applies search OR filter on name, taxNumber and shortName (case-insensitive where supported)', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findMany({ search: 'test', page: 1, pageSize: 20 });

      const findManyCall = prisma.association.findMany.mock.calls[0][0];
      expect(findManyCall?.where).toEqual({
        deletedAt: null,
        OR: [
          { name: { contains: 'test', mode: 'insensitive' } },
          { taxNumber: { contains: 'test' } },
          { shortName: { contains: 'test', mode: 'insensitive' } },
        ],
      });
    });

    it('applies case-insensitive city filter when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findMany({ city: 'Ankara', page: 1, pageSize: 20 });

      const findManyCall = prisma.association.findMany.mock.calls[0][0];
      expect(findManyCall?.where).toMatchObject({
        deletedAt: null,
        city: { equals: 'Ankara', mode: 'insensitive' },
      });
    });

    it('applies isActive filter when provided', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findMany({ isActive: true, page: 1, pageSize: 20 });

      const findManyCall = prisma.association.findMany.mock.calls[0][0];
      expect(findManyCall?.where).toMatchObject({
        deletedAt: null,
        isActive: true,
      });
    });

    it('omits isActive when undefined', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findMany({ page: 1, pageSize: 20 });

      const findManyCall = prisma.association.findMany.mock.calls[0][0];
      expect(findManyCall?.where).not.toHaveProperty('isActive');
    });

    it('computes skip correctly for first page', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findMany({ page: 1, pageSize: 25 });

      expect(prisma.association.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 25 }),
      );
    });

    it('runs findMany and count in a single $transaction', async () => {
      prisma.$transaction.mockResolvedValue([[], 0] as never);

      await repository.findMany({ page: 1, pageSize: 20 });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txArgs = prisma.$transaction.mock.calls[0][0] as unknown as unknown[];
      expect(Array.isArray(txArgs)).toBe(true);
      expect(txArgs.length).toBe(2);
    });
  });

  describe('existsByTaxNumber', () => {
    it('returns true when a record with the given taxNumber exists (via findUnique)', async () => {
      prisma.association.findUnique.mockResolvedValue(sampleAssociation as never);

      const result = await repository.existsByTaxNumber('1234567890');

      expect(prisma.association.findUnique).toHaveBeenCalledWith({
        where: { taxNumber: '1234567890' },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it('returns false when no record matches', async () => {
      prisma.association.findUnique.mockResolvedValue(null);

      const result = await repository.existsByTaxNumber('9999999999');

      expect(result).toBe(false);
    });
  });
});
