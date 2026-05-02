// jose v6 is ESM-only and ts-jest can't transform it. AuthService imports
// jose for JWT issuance; this spec exercises only `approveBranchRegistration`,
// so an empty stub keeps Jest's CJS runtime happy.
jest.mock('jose', () => ({}));

import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PrismaClient,
  PrismaService,
  PendingBranchStatus,
  Prisma,
} from '@ticketbot/database';
import { AuthService } from './auth.service';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';

type PrismaMock = DeepMockProxy<PrismaClient>;

const REG_ID = 'reg-1';
const ADMIN_ID = 'admin-1';
const SUPABASE_USER_ID = 'sup-new-user';

const pendingRegistration = {
  id: REG_ID,
  email: 'baskan@yenidernek.test',
  fullName: 'Yeni Başkan',
  phone: '+905554443322',
  city: 'Ankara',
  district: 'Çankaya',
  message: null,
  status: PendingBranchStatus.PENDING,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-04-30T00:00:00.000Z'),
  updatedAt: new Date('2026-04-30T00:00:00.000Z'),
};

describe('AuthService.approveBranchRegistration — saga rollback discipline', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let supabaseAuth: { inviteUserByEmail: jest.Mock; deleteUser: jest.Mock };
  let supabaseAdmin: { getAuthClient: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    // Run callback transactions against the same mock so `tx.X` resolves to `prisma.X`.
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: PrismaMock) => unknown)(prisma);
        }
        return Promise.all(arg as unknown[]);
      },
    );

    supabaseAuth = {
      inviteUserByEmail: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    supabaseAdmin = {
      getAuthClient: jest.fn(() => supabaseAuth),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'webUrl') return 'https://web.test';
        if (key === 'jwt.secret') return 'secret';
        return undefined;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: SupabaseAdminService, useValue: supabaseAdmin },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('throws NotFoundException when registration does not exist (no Supabase work)', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(null);

    await expect(
      service.approveBranchRegistration('missing', ADMIN_ID),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(supabaseAuth.inviteUserByEmail).not.toHaveBeenCalled();
    expect(supabaseAuth.deleteUser).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when registration is not in PENDING state', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue({
      ...pendingRegistration,
      status: PendingBranchStatus.APPROVED,
    } as never);

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(supabaseAuth.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a branch already exists for the same city + district', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue({
      id: 'assoc-existing',
      name: 'Mevcut Şube',
    } as never);

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    // Pre-check rejects before sending an email.
    expect(supabaseAuth.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('happy path: creates association + manager membership and does NOT roll back the Supabase user', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue(null);
    supabaseAuth.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: SUPABASE_USER_ID } },
      error: null,
    });
    prisma.user.upsert.mockResolvedValue({
      id: 'user-new',
      email: pendingRegistration.email,
    } as never);
    prisma.association.create.mockResolvedValue({
      id: 'assoc-new',
    } as never);
    prisma.associationMembership.create.mockResolvedValue({
      id: 'mem-new',
    } as never);

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).resolves.toEqual({});

    expect(supabaseAuth.inviteUserByEmail).toHaveBeenCalledTimes(1);
    expect(prisma.associationMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-new',
        associationId: 'assoc-new',
        role: 'ASSOCIATION_MANAGER',
        isActive: true,
      }),
    });
    expect(supabaseAuth.deleteUser).not.toHaveBeenCalled();
  });

  it('rolls back the Supabase user when the local transaction fails (CLAUDE.md provisioning saga)', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue(null);
    supabaseAuth.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: SUPABASE_USER_ID } },
      error: null,
    });
    prisma.user.upsert.mockResolvedValue({ id: 'user-new' } as never);
    prisma.association.create.mockResolvedValue({ id: 'assoc-new' } as never);
    const violation = new Prisma.PrismaClientKnownRequestError(
      'one_active_manager_per_association',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['associationId'] } },
    );
    prisma.associationMembership.create.mockRejectedValue(violation);

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(supabaseAuth.deleteUser).toHaveBeenCalledWith(SUPABASE_USER_ID);
  });

  it('logs and continues when the Supabase rollback itself fails (does not mask the original error)', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue(null);
    supabaseAuth.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: SUPABASE_USER_ID } },
      error: null,
    });
    prisma.user.upsert.mockRejectedValue(new Error('database unavailable'));
    supabaseAuth.deleteUser.mockRejectedValue(new Error('supabase down'));

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toThrow('database unavailable');

    expect(supabaseAuth.deleteUser).toHaveBeenCalledWith(SUPABASE_USER_ID);
  });

  it('translates Supabase invite error into BadRequestException (no rollback needed)', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue(null);
    supabaseAuth.inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: 'rate limited' },
    });

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Invite failed → no Supabase user was actually created → nothing to roll back.
    expect(supabaseAuth.deleteUser).not.toHaveBeenCalled();
  });
});
