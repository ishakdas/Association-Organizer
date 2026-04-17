import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import * as jose from 'jose';
import { PrismaService } from '@ticketbot/database';

@Injectable()
export class AuthGuard implements CanActivate {
  private jwksCache: jose.JWTVerifyGetKey | null = null;

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

    try {
      // Try HS256 (bot tokens) first — they have the 'bot' issuer
      const payload = await this.verifyToken(token);

      // Look up user by supabaseId
      const user = await this.prisma.user.findUnique({
        where: { supabaseId: payload.sub as string },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      (request as any).user = {
        id: user.id,
        email: user.email,
        supabaseId: user.supabaseId,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: FastifyRequest): string | null {
    const auth = request.headers.authorization;
    if (!auth) return null;
    const [scheme, token] = auth.split(' ');
    return scheme === 'Bearer' ? token : null;
  }

  private async verifyToken(token: string): Promise<jose.JWTPayload> {
    const jwtSecret = this.config.get<string>('jwt.secret')!;

    // Decode header to check algorithm
    const header = jose.decodeProtectedHeader(token);

    if (header.alg === 'HS256') {
      // Bot-issued token
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jose.jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });
      return payload;
    }

    // Supabase JWT — verify with the JWT secret (symmetric for Supabase)
    const supabaseSecret = this.config.get<string>('supabase.jwtSecret')!;
    const secret = new TextEncoder().encode(supabaseSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return payload;
  }
}
