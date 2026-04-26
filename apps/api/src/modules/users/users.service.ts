import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService, Prisma, User } from '@ticketbot/database';
import { SupabaseAdminService } from '../supabase/supabase-admin.service';

export interface CreateSupabaseUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface CreateDbOnlyUserInput {
  fullName: string;
  phone?: string;
  email?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseAdminService,
  ) {}

  /**
   * Create a Supabase auth user *and* a mirroring local User row.
   * Behaves transactionally: if the local insert fails, the Supabase
   * user is deleted before we throw — no orphaned auth identities.
   */
  async createSupabaseUser(input: CreateSupabaseUserInput): Promise<User> {
    const auth = this.supabase.getAuthClient();

    const { data, error } = await auth.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });

    if (error || !data?.user) {
      throw new ConflictException(
        error?.message ?? 'Supabase kullanıcısı oluşturulamadı',
      );
    }

    const supabaseUserId = data.user.id;

    try {
      return await this.prisma.user.create({
        data: {
          supabaseUserId,
          email: input.email,
          fullName: input.fullName,
          phone: input.phone ?? null,
          isActive: true,
        },
      });
    } catch (e) {
      try {
        await auth.deleteUser(supabaseUserId);
      } catch (rollbackErr) {
        this.logger.error(
          `Supabase rollback failed for ${supabaseUserId}: ${
            (rollbackErr as Error).message
          }`,
        );
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu e-posta zaten kayıtlı bir kullanıcıya ait',
        );
      }
      throw e;
    }
  }

  /**
   * Create a User row that exists only in our DB (no Supabase identity).
   * Used for members added by an admin who don't have web logins yet.
   */
  async createDbOnlyUser(input: CreateDbOnlyUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          supabaseUserId: null,
          email: input.email ?? null,
          fullName: input.fullName,
          phone: input.phone ?? null,
          isActive: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu e-posta zaten kayıtlı bir kullanıcıya ait',
        );
      }
      throw e;
    }
  }

  findBySupabaseId(supabaseUserId: string) {
    return this.prisma.user.findUnique({ where: { supabaseUserId } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Saga rollback helper: tear down a user we just created (both sides).
   * Best-effort on the Supabase side — if it fails the local row is still
   * deleted so we don't leak orphaned DB rows. Failures are logged.
   */
  async deleteUser(user: {
    id: string;
    supabaseUserId: string | null;
  }): Promise<void> {
    if (user.supabaseUserId) {
      try {
        await this.supabase.getAuthClient().deleteUser(user.supabaseUserId);
      } catch (err) {
        this.logger.error(
          `Supabase deleteUser failed for ${user.supabaseUserId}: ${
            (err as Error).message
          }`,
        );
      }
    }
    await this.prisma.user.delete({ where: { id: user.id } });
  }
}
