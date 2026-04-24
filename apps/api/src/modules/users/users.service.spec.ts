import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ConflictException } from '@nestjs/common';
import { PrismaClient, PrismaService, Prisma } from '@ticketbot/database';
import { UsersService } from './users.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';

type PrismaMock = DeepMockProxy<PrismaClient>;

interface AuthAdminMock {
  createUser: jest.Mock;
  deleteUser: jest.Mock;
}

const SUP_USER_ID = '11111111-2222-3333-4444-555555555555';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;
  let authAdmin: AuthAdminMock;
  let supabase: { getAuthClient: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    authAdmin = {
      createUser: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
    };
    supabase = { getAuthClient: jest.fn(() => authAdmin) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseAdminService, useValue: supabase },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('createSupabaseUser', () => {
    it('creates the Supabase auth user and the local User row, returning the row', async () => {
      authAdmin.createUser.mockResolvedValue({
        data: { user: { id: SUP_USER_ID } },
        error: null,
      });
      prisma.user.create.mockResolvedValue({
        id: 'u-1',
        supabaseUserId: SUP_USER_ID,
        email: 'ali@dernek.local',
        fullName: 'Ali Veli',
        phone: '+905551112233',
        isActive: true,
      } as never);

      const result = await service.createSupabaseUser({
        email: 'ali@dernek.local',
        password: 'Strong-pass-123',
        fullName: 'Ali Veli',
        phone: '+905551112233',
      });

      expect(authAdmin.createUser).toHaveBeenCalledWith({
        email: 'ali@dernek.local',
        password: 'Strong-pass-123',
        email_confirm: true,
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'ali@dernek.local',
          fullName: 'Ali Veli',
          phone: '+905551112233',
          supabaseUserId: SUP_USER_ID,
          isActive: true,
        }),
      });
      expect(authAdmin.deleteUser).not.toHaveBeenCalled();
      expect(result.id).toBe('u-1');
    });

    it('rolls back the Supabase user when the local User insert hits a duplicate-email constraint', async () => {
      authAdmin.createUser.mockResolvedValue({
        data: { user: { id: SUP_USER_ID } },
        error: null,
      });
      const dupErr = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
      );
      prisma.user.create.mockRejectedValue(dupErr);

      await expect(
        service.createSupabaseUser({
          email: 'dup@dernek.local',
          password: 'Strong-pass-123',
          fullName: 'Duplicate User',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      // Rollback — the Supabase user we just created must be deleted.
      expect(authAdmin.deleteUser).toHaveBeenCalledWith(SUP_USER_ID);
    });

    it('translates a Supabase createUser error into ConflictException without touching Prisma', async () => {
      authAdmin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'A user with this email already exists', status: 422 },
      });

      await expect(
        service.createSupabaseUser({
          email: 'taken@dernek.local',
          password: 'Strong-pass-123',
          fullName: 'Taken User',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(authAdmin.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('createDbOnlyUser', () => {
    it('creates a User row with supabaseUserId=null', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'u-2',
        supabaseUserId: null,
        email: null,
        fullName: 'Veli Dede',
        phone: '+905552223344',
        isActive: true,
      } as never);

      const result = await service.createDbOnlyUser({
        fullName: 'Veli Dede',
        phone: '+905552223344',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: 'Veli Dede',
          phone: '+905552223344',
          supabaseUserId: null,
          isActive: true,
        }),
      });
      expect(result.id).toBe('u-2');
      expect(authAdmin.createUser).not.toHaveBeenCalled();
    });

    it('translates duplicate-email Prisma error into ConflictException', async () => {
      const dupErr = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: 'test', meta: { target: ['email'] } },
      );
      prisma.user.create.mockRejectedValue(dupErr);

      await expect(
        service.createDbOnlyUser({
          fullName: 'X',
          email: 'taken@dernek.local',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('finders', () => {
    it('findBySupabaseId returns the user row or null', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1' } as never);
      const got = await service.findBySupabaseId(SUP_USER_ID);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { supabaseUserId: SUP_USER_ID },
      });
      expect(got).toEqual({ id: 'u-1' });
    });

    it('findById returns the user row or null', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const got = await service.findById('missing');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing' },
      });
      expect(got).toBeNull();
    });
  });
});
