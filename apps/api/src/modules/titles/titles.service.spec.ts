import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { TitlesService } from './titles.service';

type PrismaMock = DeepMockProxy<PrismaClient>;

const sample = {
  id: 'title-1',
  name: 'Teşkilat Başkanı',
  slug: 'teskilat-baskani',
  description: 'Üye kazanımı, koordinasyon, teşkilatlanma',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date('2026-04-24'),
  updatedAt: new Date('2026-04-24'),
};

describe('TitlesService', () => {
  let service: TitlesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TitlesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TitlesService);
  });

  describe('list', () => {
    it('returns only active titles, sorted by sortOrder', async () => {
      prisma.memberTitleDefinition.findMany.mockResolvedValue([sample] as never);

      const result = await service.list();

      expect(prisma.memberTitleDefinition.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          sortOrder: true,
          isActive: true,
        },
      });
      expect(result).toEqual([sample]);
    });

    it('drops the isActive filter when includeInactive=true (admin view)', async () => {
      prisma.memberTitleDefinition.findMany.mockResolvedValue([
        sample,
        { ...sample, id: 'title-2', isActive: false },
      ] as never);

      const result = await service.list({ includeInactive: true });

      expect(prisma.memberTitleDefinition.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          sortOrder: true,
          isActive: true,
        },
      });
      expect(result).toHaveLength(2);
    });

    it('includes description in the select clause', async () => {
      prisma.memberTitleDefinition.findMany.mockResolvedValue([sample] as never);

      await service.list();

      expect(prisma.memberTitleDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ description: true }),
        }),
      );
    });
  });

  describe('create', () => {
    it('derives a Turkish-aware slug and persists when the slug is free', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(null);
      prisma.memberTitleDefinition.create.mockResolvedValue(sample as never);

      const result = await service.create({
        name: 'Teşkilat Başkanı',
        sortOrder: 0,
        isActive: true,
      });

      expect(prisma.memberTitleDefinition.findUnique).toHaveBeenCalledWith({
        where: { slug: 'teskilat-baskani' },
        select: { id: true },
      });
      expect(prisma.memberTitleDefinition.create).toHaveBeenCalledWith({
        data: {
          name: 'Teşkilat Başkanı',
          slug: 'teskilat-baskani',
          description: null,
          sortOrder: 0,
          isActive: true,
        },
      });
      expect(result).toEqual(sample);
    });

    it('persists description when provided', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(null);
      prisma.memberTitleDefinition.create.mockResolvedValue(sample as never);

      await service.create({
        name: 'Teşkilat Başkanı',
        description: 'Üye kazanımı, koordinasyon, teşkilatlanma',
        sortOrder: 0,
        isActive: true,
      });

      expect(prisma.memberTitleDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Üye kazanımı, koordinasyon, teşkilatlanma',
        }),
      });
    });

    it('appends a -2 suffix when the base slug is taken', async () => {
      prisma.memberTitleDefinition.findUnique
        .mockResolvedValueOnce({ id: 'existing-1' } as never) // base taken
        .mockResolvedValueOnce(null); // -2 free
      prisma.memberTitleDefinition.create.mockResolvedValue({
        ...sample,
        slug: 'teskilat-baskani-2',
      } as never);

      const result = await service.create({
        name: 'Teşkilat Başkanı',
        sortOrder: 0,
        isActive: true,
      });

      expect(prisma.memberTitleDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'teskilat-baskani-2' }),
      });
      expect(result.slug).toBe('teskilat-baskani-2');
    });

    it('walks the suffix counter past existing -2/-3 collisions', async () => {
      prisma.memberTitleDefinition.findUnique
        .mockResolvedValueOnce({ id: 'a' } as never) // base
        .mockResolvedValueOnce({ id: 'b' } as never) // -2
        .mockResolvedValueOnce({ id: 'c' } as never) // -3
        .mockResolvedValueOnce(null); // -4 free
      prisma.memberTitleDefinition.create.mockResolvedValue({
        ...sample,
        slug: 'teskilat-baskani-4',
      } as never);

      await service.create({
        name: 'Teşkilat Başkanı',
        sortOrder: 0,
        isActive: true,
      });

      expect(prisma.memberTitleDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'teskilat-baskani-4' }),
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the title does not exist', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X', sortOrder: 0, isActive: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.memberTitleDefinition.update).not.toHaveBeenCalled();
    });

    it('updates only provided fields without recomputing slug', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
      prisma.memberTitleDefinition.update.mockResolvedValue({
        ...sample,
        sortOrder: 5,
      } as never);

      const result = await service.update(sample.id, { sortOrder: 5 });

      expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
        where: { id: sample.id },
        data: { sortOrder: 5 },
      });
      expect(result.sortOrder).toBe(5);
    });

    it('updates description when provided', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
      prisma.memberTitleDefinition.update.mockResolvedValue({
        ...sample,
        description: 'Güncel açıklama',
      } as never);

      const result = await service.update(sample.id, { description: 'Güncel açıklama' });

      expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
        where: { id: sample.id },
        data: { description: 'Güncel açıklama' },
      });
      expect(result.description).toBe('Güncel açıklama');
    });

    it('clears description when null is passed', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
      prisma.memberTitleDefinition.update.mockResolvedValue({
        ...sample,
        description: null,
      } as never);

      const result = await service.update(sample.id, { description: null });

      expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
        where: { id: sample.id },
        data: { description: null },
      });
      expect(result.description).toBeNull();
    });

    it('honors explicit isActive=false (deactivate via PATCH)', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
      prisma.memberTitleDefinition.update.mockResolvedValue({
        ...sample,
        isActive: false,
      } as never);

      const result = await service.update(sample.id, { isActive: false });

      expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
        where: { id: sample.id },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove (soft delete)', () => {
    it('throws NotFoundException when the title does not exist', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.memberTitleDefinition.update).not.toHaveBeenCalled();
    });

    it('flips isActive to false (no row deletion)', async () => {
      prisma.memberTitleDefinition.findUnique.mockResolvedValue(sample as never);
      prisma.memberTitleDefinition.update.mockResolvedValue({
        ...sample,
        isActive: false,
      } as never);

      const result = await service.remove(sample.id);

      expect(prisma.memberTitleDefinition.update).toHaveBeenCalledWith({
        where: { id: sample.id },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });
});
