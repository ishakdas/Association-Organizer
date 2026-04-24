import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import * as jose from 'jose';
import { PrismaService } from '@ticketbot/database';
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

    (request as any).user = {
      id: user.id,
      email: user.email,
      supabaseId: user.supabaseUserId,
    };
    (request as any).tokenKind = verified.kind;

    return true;
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
