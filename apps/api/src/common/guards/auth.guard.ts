import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import * as jose from 'jose';
import { PrismaService, UserRole } from '@ticketbot/database';
import type {
  AuthMembership,
  AuthTelegramAccount,
  AuthenticatedUser,
} from '@ticketbot/shared-types';
import { BOT_JWT_ISSUER } from '../../modules/auth/auth.constants';

type TokenKind = 'bot' | 'supabase';

interface VerifiedToken {
  kind: TokenKind;
  payload: jose.JWTPayload & { email?: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private supabaseJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const verified = await this.verify(token);
    const user = await this.resolveUser(verified);
    const memberships = await this.loadMemberships(user.id);
    const telegramAccount = await this.loadTelegramAccount(user.id);

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      supabaseUserId: user.supabaseUserId,
      memberships,
      systemRole: memberships.some((m) => m.role === UserRole.SYSTEM_ADMIN)
        ? UserRole.SYSTEM_ADMIN
        : null,
      telegramAccount,
      onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      mustChangePassword: user.mustChangePassword,
    };

    (request as any).user = authUser;
    (request as any).tokenKind = verified.kind;

    return true;
  }

  private async loadMemberships(userId: string): Promise<AuthMembership[]> {
    const rows = await this.prisma.associationMembership.findMany({
      where: { userId, isActive: true, deletedAt: null },
      select: {
        id: true,
        associationId: true,
        role: true,
        isActive: true,
      },
    });
    return rows;
  }

  private async loadTelegramAccount(
    userId: string,
  ): Promise<AuthTelegramAccount | null> {
    const row = await this.prisma.telegramAccount.findUnique({
      where: { userId },
      select: {
        telegramId: true,
        username: true,
        firstName: true,
        createdAt: true,
      },
    });
    if (!row) return null;
    return {
      telegramId: row.telegramId.toString(),
      username: row.username,
      firstName: row.firstName,
      linkedAt: row.createdAt.toISOString(),
    };
  }

  private extractToken(request: FastifyRequest): string | null {
    const auth = request.headers.authorization;
    if (!auth) return null;
    const [scheme, token] = auth.split(' ');
    return scheme === 'Bearer' ? token : null;
  }

  private async verify(token: string): Promise<VerifiedToken> {
    // 1) Bot tokens: HS256 with our issuer claim. Try first — cheapest + deterministic.
    try {
      const botSecret = new TextEncoder().encode(this.config.get<string>('jwt.secret')!);
      const { payload } = await jose.jwtVerify(token, botSecret, {
        algorithms: ['HS256'],
        issuer: BOT_JWT_ISSUER,
      });
      return { kind: 'bot', payload };
    } catch {
      // Fall through — probably a Supabase token.
    }

    // 2) Supabase ES256/RS256 via JWKS (new Supabase default).
    try {
      const { payload } = await jose.jwtVerify(token, this.getSupabaseJwks(), {
        algorithms: ['ES256', 'RS256'],
      });
      return { kind: 'supabase', payload };
    } catch {
      // Fall through to legacy HS256.
    }

    // 3) Supabase HS256 legacy (older projects) — verify with SUPABASE_JWT_SECRET.
    try {
      const supabaseSecret = new TextEncoder().encode(
        this.config.get<string>('supabase.jwtSecret')!,
      );
      const { payload } = await jose.jwtVerify(token, supabaseSecret, {
        algorithms: ['HS256'],
      });
      return { kind: 'supabase', payload };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getSupabaseJwks() {
    if (!this.supabaseJwks) {
      const baseUrl = this.config.get<string>('supabase.url')!;
      this.supabaseJwks = jose.createRemoteJWKSet(
        new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`),
      );
    }
    return this.supabaseJwks;
  }

  private async resolveUser({ kind, payload }: VerifiedToken) {
    const sub = payload.sub;
    if (!sub) throw new UnauthorizedException('Token missing subject');

    if (kind === 'bot') {
      // sub = internal User.id (CUID) — issued by AuthService.issueBotToken
      const user = await this.prisma.user.findUnique({ where: { id: sub } });
      if (!user) throw new UnauthorizedException('User not found');
      return user;
    }

    // Supabase: sub = auth.users.id (UUID) — mapped to User.supabaseUserId
    const existing = await this.prisma.user.findUnique({
      where: { supabaseUserId: sub },
    });
    if (existing) return existing;

    // Auto-provision on first login
    const email = payload.email;
    if (!email) {
      throw new UnauthorizedException('Cannot auto-provision user without email claim');
    }

    // fullName is required by schema; derive from JWT claims or email local-part
    const meta = (payload as any).user_metadata as
      | { full_name?: string; name?: string }
      | undefined;
    const fullName =
      meta?.full_name?.trim() || meta?.name?.trim() || email.split('@')[0];

    return this.prisma.user.upsert({
      where: { email },
      update: { supabaseUserId: sub },
      create: { email, supabaseUserId: sub, fullName },
    });
  }
}
