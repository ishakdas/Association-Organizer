/**
 * jose v6 is ESM-only and ts-jest cannot transform it. We replace the small
 * surface AuthGuard touches (`jwtVerify`, `createRemoteJWKSet`) with a tiny
 * HS256 verifier built on Node's crypto. That keeps the test runner CJS-pure
 * while exercising the real guard logic (token kind dispatch, issuer/exp
 * checks, user resolution).
 */
import { createHmac, timingSafeEqual } from 'crypto';

jest.mock('jose', () => {
  function b64urlDecode(str: string): Buffer {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
  }

  function verifyHs256(token: string, secret: Uint8Array | Buffer) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');
    const [h, p, s] = parts;
    const expected = createHmac('sha256', Buffer.from(secret))
      .update(`${h}.${p}`)
      .digest();
    const got = b64urlDecode(s);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      throw new Error('Invalid signature');
    }
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'));
    const header = JSON.parse(b64urlDecode(h).toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new Error('Token expired');
    }
    return { payload, header };
  }

  return {
    jwtVerify: jest.fn(
      async (
        token: string,
        keyOrJwks: Uint8Array | Buffer | (() => unknown),
        opts?: { algorithms?: string[]; issuer?: string },
      ) => {
        // Tests only sign HS256 with raw secrets — the JWKS path returns a
        // function that we never invoke (Supabase JWKS path is not exercised
        // in this spec).
        if (typeof keyOrJwks === 'function') {
          throw new Error('JWKS path not exercised in this spec');
        }
        const { payload, header } = verifyHs256(token, keyOrJwks);
        if (opts?.algorithms && !opts.algorithms.includes(header.alg)) {
          throw new Error('alg mismatch');
        }
        if (opts?.issuer && payload.iss !== opts.issuer) {
          throw new Error('iss mismatch');
        }
        return { payload, protectedHeader: header };
      },
    ),
    createRemoteJWKSet: jest.fn(() => () => {
      throw new Error('JWKS path not exercised in this spec');
    }),
  };
});

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { AuthGuard } from './auth.guard';
import { BOT_JWT_ISSUER } from '../../modules/auth/auth.constants';

type PrismaMock = DeepMockProxy<PrismaClient>;

const BOT_SECRET = 'bot-secret-for-tests-min-32-chars-long-xx';
const SUPABASE_JWT_SECRET = 'supabase-secret-for-tests-min-32-chars-xx';

function ctxWith(headers: Record<string, string>): {
  ctx: ExecutionContext;
  request: { headers: Record<string, string>; user?: unknown };
} {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Mint a real HS256 JWT using Node crypto so jest doesn't need to load jose
 * (jose v6 is ESM-only and ts-jest can't transform it without extra config).
 * AuthGuard verifies with jose under ts-node-dev — different runtime.
 */
function mintHs256({
  payload,
  secret,
}: {
  payload: Record<string, unknown>;
  secret: string;
}): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const sig = b64url(createHmac('sha256', secret).update(signingInput).digest());
  return `${signingInput}.${sig}`;
}

function mintBotToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return mintHs256({
    payload: {
      sub: userId,
      iss: BOT_JWT_ISSUER,
      iat: now,
      exp: now + 3600,
      telegramId: '123',
    },
    secret: BOT_SECRET,
  });
}

describe('AuthGuard — request.user enrichment', () => {
  let guard: AuthGuard;
  let prisma: PrismaMock;
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    config = {
      get: jest.fn((key: string) => {
        if (key === 'jwt.secret') return BOT_SECRET;
        if (key === 'supabase.jwtSecret') return SUPABASE_JWT_SECRET;
        if (key === 'supabase.url') return 'https://example.supabase.co';
        return undefined;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    guard = moduleRef.get(AuthGuard);
  });

  it('attaches AuthenticatedUser with active memberships and null systemRole when user has only association roles', async () => {
    const userId = 'user-1';
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'sec@dernek.local',
      fullName: 'Sekreter Sara',
      supabaseUserId: null,
      isActive: true,
    } as never);
    prisma.associationMembership.findMany.mockResolvedValue([
      {
        id: 'mem-1',
        associationId: 'assoc-1',
        role: 'ASSOCIATION_SECRETARY',
        isActive: true,
      },
    ] as never);

    const token = mintBotToken(userId);
    const { ctx, request } = ctxWith({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(request.user).toEqual({
      id: 'user-1',
      email: 'sec@dernek.local',
      fullName: 'Sekreter Sara',
      supabaseUserId: null,
      memberships: [
        {
          id: 'mem-1',
          associationId: 'assoc-1',
          role: 'ASSOCIATION_SECRETARY',
          isActive: true,
        },
      ],
      systemRole: null,
      telegramAccount: null,
      onboardingCompletedAt: null,
      mustChangePassword: undefined,
    });
  });

  it('derives systemRole=SYSTEM_ADMIN when any active membership has SYSTEM_ADMIN role', async () => {
    const userId = 'user-admin';
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'admin@dev.local',
      fullName: 'Sistem Admin',
      supabaseUserId: null,
      isActive: true,
    } as never);
    prisma.associationMembership.findMany.mockResolvedValue([
      {
        id: 'mem-sys',
        associationId: 'assoc-root',
        role: 'SYSTEM_ADMIN',
        isActive: true,
      },
      {
        id: 'mem-other',
        associationId: 'assoc-1',
        role: 'ASSOCIATION_MEMBER',
        isActive: true,
      },
    ] as never);

    const token = mintBotToken(userId);
    const { ctx, request } = ctxWith({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request.user as any).systemRole).toBe('SYSTEM_ADMIN');
    expect((request.user as any).memberships).toHaveLength(2);
  });

  it('returns null systemRole when user has no active memberships', async () => {
    const userId = 'user-empty';
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'empty@dev.local',
      fullName: 'Sade Kullanıcı',
      supabaseUserId: null,
      isActive: true,
    } as never);
    prisma.associationMembership.findMany.mockResolvedValue([] as never);

    const token = mintBotToken(userId);
    const { ctx, request } = ctxWith({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request.user as any).systemRole).toBeNull();
    expect((request.user as any).memberships).toEqual([]);
  });

  it('rejects missing Authorization header', async () => {
    const { ctx } = ctxWith({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
