import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AssociationsService } from './associations.service';
import { AssociationsRepository } from './associations.repository';

type RepoMock = DeepMockProxy<AssociationsRepository>;

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
  createdById: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

const validCreateInput = {
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
};

describe('AssociationsService', () => {
  let service: AssociationsService;
  let repo: RepoMock;

  beforeEach(async () => {
    repo = mockDeep<AssociationsRepository>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssociationsService,
        { provide: AssociationsRepository, useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(AssociationsService);
  });

  describe('create', () => {
    it('throws ConflictException when taxNumber already exists', async () => {
      repo.existsByTaxNumber.mockResolvedValue(true);

      await expect(service.create(validCreateInput, 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.existsByTaxNumber).toHaveBeenCalledWith('1234567890');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates the association when taxNumber is unique, coerces foundedAt to Date, and attaches createdById', async () => {
      repo.existsByTaxNumber.mockResolvedValue(false);
      repo.create.mockResolvedValue(sampleAssociation as never);

      const result = await service.create(validCreateInput, 'user-1');

      expect(repo.existsByTaxNumber).toHaveBeenCalledWith('1234567890');
      expect(repo.create).toHaveBeenCalledTimes(1);

      const createArg = repo.create.mock.calls[0][0];
      expect(createArg).toMatchObject({
        name: 'Test Derneği',
        taxNumber: '1234567890',
        createdById: 'user-1',
      });
      expect(createArg.foundedAt).toBeInstanceOf(Date);
      expect((createArg.foundedAt as Date).toISOString()).toBe(
        '2020-01-01T00:00:00.000Z',
      );
      expect(result).toEqual(sampleAssociation);
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

  describe('list', () => {
    it('returns data and pagination meta with totalPages = ceil(total / pageSize)', async () => {
      repo.findMany.mockResolvedValue({
        data: [sampleAssociation] as never,
        total: 42,
      });

      const result = await service.list({
        page: 2,
        pageSize: 10,
      } as never);

      expect(repo.findMany).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
      expect(result).toEqual({
        data: [sampleAssociation],
        meta: { total: 42, page: 2, pageSize: 10, totalPages: 5 },
      });
    });

    it('returns totalPages = 1 when total is 0 (empty list still shows one page)', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 0 });

      const result = await service.list({ page: 1, pageSize: 20 } as never);

      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('passes through search / isActive / city filters to the repository', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 0 });

      const query = {
        search: 'test',
        isActive: true,
        city: 'Ankara',
        page: 1,
        pageSize: 20,
      };
      await service.list(query as never);

      expect(repo.findMany).toHaveBeenCalledWith(query);
    });

    it('rounds up fractional pages (total=21, pageSize=10 → totalPages=3)', async () => {
      repo.findMany.mockResolvedValue({ data: [], total: 21 });

      const result = await service.list({ page: 1, pageSize: 10 } as never);

      expect(result.meta.totalPages).toBe(3);
    });
  });
});
