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
import { EmailService } from '../email/email.service';
import { PermissionService } from '../permissions/permission.service';

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
  let supabaseAuth: { createUser: jest.Mock; deleteUser: jest.Mock };
  let supabaseAdmin: { getAuthClient: jest.Mock; generateMagicLink: jest.Mock };
  let emailService: { sendMagicLink: jest.Mock; sendTelegramLinkEmail: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: PrismaMock) => unknown)(prisma);
        }
        return Promise.all(arg as unknown[]);
      },
    );

    supabaseAuth = {
      createUser: jest.fn().mockResolvedValue({
        data: { user: { id: SUPABASE_USER_ID } },
        error: null,
      }),
      deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    supabaseAdmin = {
      getAuthClient: jest.fn(() => supabaseAuth),
      generateMagicLink: jest.fn().mockResolvedValue({
        url: 'https://web.test/callback-magic?next=/onboarding&token=abc',
      }),
    };

    emailService = {
      sendMagicLink: jest.fn().mockResolvedValue({ messageId: 'msg-123', previewUrl: null }),
      sendTelegramLinkEmail: jest.fn().mockResolvedValue({ messageId: 'msg-telegram-123', previewUrl: null }),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'webUrl') return 'https://web.test';
        if (key === 'jwt.secret') return 'secret';
        if (key === 'telegramBotUsername') return 'test_bot';
        return undefined;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: SupabaseAdminService, useValue: supabaseAdmin },
        { provide: EmailService, useValue: emailService },
        {
          provide: PermissionService,
          useValue: {
            applyMembershipDefaults: jest.fn(),
            applyTitleDerivedPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('throws NotFoundException when registration does not exist (no Supabase work)', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(null);

    await expect(
      service.approveBranchRegistration('missing', ADMIN_ID),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(supabaseAuth.createUser).not.toHaveBeenCalled();
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

    expect(supabaseAuth.createUser).not.toHaveBeenCalled();
  });

  it('throws ConflictException when an active branch already exists for the same city + district', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue({
      id: 'assoc-existing',
      name: 'Mevcut Şube',
      createdBy: { id: 'user-active', supabaseUserId: 'sup-active', activatedAt: new Date() },
    } as never);

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(supabaseAuth.createUser).not.toHaveBeenCalled();
  });

  it('auto-cleans an orphaned branch (creator never activated) and proceeds with approval', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue({
      id: 'assoc-orphaned',
      name: 'Orphaned Şube',
      createdBy: { id: 'user-orphaned', supabaseUserId: 'sup-orphaned', activatedAt: null },
    } as never);
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
    ).resolves.toEqual({
      emailSent: true,
      magicLink: expect.any(String),
      messageId: expect.any(String),
    });

    expect(supabaseAuth.deleteUser).toHaveBeenCalledWith('sup-orphaned');
    expect(supabaseAuth.createUser).toHaveBeenCalledTimes(1);
    expect(prisma.associationMembership.create).toHaveBeenCalled();
  });

  it('happy path: creates user via Supabase, sends email via Brevo, creates association + membership, does NOT roll back', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue(null);
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
    ).resolves.toEqual({
      emailSent: true,
      magicLink: expect.any(String),
      messageId: expect.any(String),
    });

    expect(supabaseAuth.createUser).toHaveBeenCalledTimes(1);
    expect(supabaseAdmin.generateMagicLink).toHaveBeenCalledTimes(1);
    expect(emailService.sendMagicLink).toHaveBeenCalledTimes(1);
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
    prisma.user.upsert.mockRejectedValue(new Error('database unavailable'));
    supabaseAuth.deleteUser.mockRejectedValue(new Error('supabase down'));

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toThrow('database unavailable');

    expect(supabaseAuth.deleteUser).toHaveBeenCalledWith(SUPABASE_USER_ID);
  });

  it('translates Supabase create error into BadRequestException (no rollback needed)', async () => {
    prisma.pendingBranchRegistration.findUnique.mockResolvedValue(
      pendingRegistration as never,
    );
    prisma.association.findFirst.mockResolvedValue(null);
    supabaseAuth.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'rate limited' },
    });

    await expect(
      service.approveBranchRegistration(REG_ID, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(supabaseAdmin.generateMagicLink).not.toHaveBeenCalled();
    expect(supabaseAuth.deleteUser).not.toHaveBeenCalled();
  });
});

describe('AuthService.generateLinkTokenWithEmail — Telegram deep link email delivery', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let emailService: { sendTelegramLinkEmail: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    (prisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: PrismaMock) => unknown)(prisma);
        }
        return Promise.all(arg as unknown[]);
      },
    );

    emailService = {
      sendTelegramLinkEmail: jest.fn().mockResolvedValue({ messageId: 'msg-telegram-456', previewUrl: null }),
    };

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'telegramBotUsername') return 'dernek_organizer_bot';
        return undefined;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: SupabaseAdminService, useValue: {} },
        { provide: EmailService, useValue: emailService },
        {
          provide: PermissionService,
          useValue: {
            applyMembershipDefaults: jest.fn(),
            applyTitleDerivedPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('generates a token, creates deep link, and sends email via Brevo template', async () => {
    const userId = 'user-test-1';
    const email = 'test@example.com';

    prisma.telegramLinkToken.updateMany.mockResolvedValue({ count: 0 } as never);
    prisma.telegramLinkToken.create.mockResolvedValue({
      id: 'token-1',
      userId,
      token: 'abc123',
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      fullName: 'Test User',
      email,
    } as never);

    const result = await service.generateLinkTokenWithEmail(userId, email);

    // Verify token was created
    expect(prisma.telegramLinkToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );

    // Verify email was sent with correct deep link
    expect(emailService.sendTelegramLinkEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendTelegramLinkEmail).toHaveBeenCalledWith(
      email,
      'Test User',
      'dernek_organizer_bot',
      expect.stringMatching(/^https:\/\/t\.me\/dernek_organizer_bot\?start=link_/),
      expect.stringMatching(/^tg:\/\/resolve\?domain=dernek_organizer_bot&start=link_/),
      expect.any(String),
      expect.any(String),
      expect.stringMatching(/\/connect-telegram\?t=/),
    );

    // Verify response shape
    expect(result).toEqual({
      token: expect.any(String),
      expiresAt: expect.any(String),
      deepLinkUrl: expect.stringMatching(/^https:\/\/t\.me\/dernek_organizer_bot\?start=link_/),
      tgDirectUrl: expect.stringMatching(/^tg:\/\/resolve\?domain=dernek_organizer_bot&start=link_/),
      connectUrl: expect.stringMatching(/\/connect-telegram\?t=/),
      emailSent: true,
      messageId: 'msg-telegram-456',
    });

    // Verify deep link contains the same token
    const callArgs = emailService.sendTelegramLinkEmail.mock.calls[0];
    const deepLinkUrl = callArgs[3] as string;
    const tgDirectUrl = callArgs[4] as string;
    const token = callArgs[5] as string;
    expect(deepLinkUrl).toBe(`https://t.me/dernek_organizer_bot?start=link_${token}`);
    expect(tgDirectUrl).toBe(`tg://resolve?domain=dernek_organizer_bot&start=link_${token}`);
  });
});
