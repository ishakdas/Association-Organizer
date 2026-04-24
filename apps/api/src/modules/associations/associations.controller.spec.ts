import 'reflect-metadata';

// jose is ESM-only and cannot be parsed by ts-jest CJS transform.
// AuthGuard depends on it; we only need the guard symbol for metadata reflection.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { ConflictException, NotFoundException, HttpStatus } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AssociationsController } from './associations.controller';
import { AssociationsService } from './associations.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAssociationDto } from './dto/create-association.dto';
import { ListAssociationsQueryDto } from './dto/list-associations-query.dto';

type ServiceMock = DeepMockProxy<AssociationsService>;

const fakeUser = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Test User',
  supabaseUserId: 'sup-1',
  memberships: [],
  systemRole: null,
};

const sampleAssociation = {
  id: 'assoc-1',
  name: 'Test Derneği',
  taxNumber: '1234567890',
} as never;

const validBody = {
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
} as unknown as CreateAssociationDto;

describe('AssociationsController', () => {
  let controller: AssociationsController;
  let service: ServiceMock;

  beforeEach(() => {
    service = mockDeep<AssociationsService>();
    controller = new AssociationsController(service);
  });

  describe('create', () => {
    it('delegates to service.create(body, user.id) and returns its result', async () => {
      service.create.mockResolvedValue(sampleAssociation);

      const result = await controller.create(validBody, fakeUser);

      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.create).toHaveBeenCalledWith(validBody, 'user-1');
      expect(result).toBe(sampleAssociation);
    });

    it('propagates ConflictException from service (→ HTTP 409)', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Bu vergi numarasıyla kayıtlı bir dernek zaten mevcut'),
      );

      const promise = controller.create(validBody, fakeUser);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        status: HttpStatus.CONFLICT, // 409
      });
    });
  });

  describe('list', () => {
    it('delegates to service.list(query) and returns the paginated shape', async () => {
      const listResult = {
        data: [sampleAssociation],
        meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
      };
      service.list.mockResolvedValue(listResult as never);

      const query = { page: 1, pageSize: 20 } as unknown as ListAssociationsQueryDto;
      const result = await controller.list(query, fakeUser);

      expect(service.list).toHaveBeenCalledWith(query, fakeUser);
      expect(result).toEqual(listResult);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta.total');
      expect(result).toHaveProperty('meta.page');
      expect(result).toHaveProperty('meta.pageSize');
      expect(result).toHaveProperty('meta.totalPages');
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id) and returns its result', async () => {
      service.findOne.mockResolvedValue(sampleAssociation);

      const result = await controller.findOne('assoc-1');

      expect(service.findOne).toHaveBeenCalledWith('assoc-1');
      expect(result).toBe(sampleAssociation);
    });

    it('propagates NotFoundException from service (→ HTTP 404)', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Dernek bulunamadı'),
      );

      const promise = controller.findOne('missing');

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND, // 404
      });
    });
  });

  describe('route & guard metadata', () => {
    it('is mounted under the "associations" path', () => {
      const path = Reflect.getMetadata('path', AssociationsController);
      expect(path).toBe('associations');
    });

    it('applies AuthGuard, SupabaseUserGuard, and RolesGuard at the class level (in that order)', () => {
      const guards = Reflect.getMetadata('__guards__', AssociationsController);
      expect(Array.isArray(guards)).toBe(true);
      expect(guards).toEqual([AuthGuard, SupabaseUserGuard, RolesGuard]);
    });

    it('restricts POST / to SYSTEM_ADMIN via @Roles metadata', () => {
      const roles = Reflect.getMetadata(
        'roles',
        AssociationsController.prototype.create,
      );
      expect(roles).toEqual(['SYSTEM_ADMIN']);
    });

    it('exposes POST / (create)', () => {
      const method = Reflect.getMetadata('method', AssociationsController.prototype.create);
      const path = Reflect.getMetadata('path', AssociationsController.prototype.create);
      expect(method).toBe(1); // RequestMethod.POST
      expect(path).toBe('/');
    });

    it('exposes GET / (list)', () => {
      const method = Reflect.getMetadata('method', AssociationsController.prototype.list);
      const path = Reflect.getMetadata('path', AssociationsController.prototype.list);
      expect(method).toBe(0); // RequestMethod.GET
      expect(path).toBe('/');
    });

    it('exposes GET /:id (findOne)', () => {
      const method = Reflect.getMetadata('method', AssociationsController.prototype.findOne);
      const path = Reflect.getMetadata('path', AssociationsController.prototype.findOne);
      expect(method).toBe(0); // RequestMethod.GET
      expect(path).toBe(':id');
    });
  });
});
