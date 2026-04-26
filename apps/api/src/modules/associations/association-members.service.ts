import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService, Prisma, type User } from '@ticketbot/database';
import {
  AddMemberInput,
  ListMembersQuery,
  UpdateMemberInput,
} from '@ticketbot/shared-validation';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

const memberInclude = {
  user: {
    include: {
      telegramAccount: {
        select: { username: true, firstName: true, createdAt: true },
      },
    },
  },
  title: true,
} as const;

@Injectable()
export class AssociationMembersService {
  private readonly logger = new Logger(AssociationMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async create(associationId: string, input: AddMemberInput) {
    await this.ensureAssociation(associationId);

    // --- Re-use existing user if the email is already in our DB ---
    // This covers the case where a user was a member of an association that
    // was later deleted: the membership is removed but the User row stays,
    // so attempting to add the same email again must NOT create a duplicate.
    if (input.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true, supabaseUserId: true, isActive: true },
      });

      if (existing) {
        // Reactivate if previously deactivated.
        if (!existing.isActive) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: { isActive: true },
          });
        }

        try {
          return await this.prisma.associationMembership.create({
            data: {
              associationId,
              userId: existing.id,
              role: input.role,
              titleId: input.titleId ?? null,
              customTitle: input.customTitle ?? null,
              isActive: true,
            },
            include: memberInclude,
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            throw new ConflictException(
              'Bu üye bu dernekte zaten kayıtlı',
            );
          }
          throw e;
        }
      }
    }

    // --- No existing user found: original saga path ---
    // Saga path: secretaries get a Supabase auth user (web login).
    // Schema enforces password+email presence for SECRETARY role.
    const provisionsSupabase =
      input.role === 'ASSOCIATION_SECRETARY' && !!input.password;

    let createdUser: User | null = null;
    try {
      createdUser = provisionsSupabase
        ? await this.users.createSupabaseUser({
            email: input.email!,
            password: input.password!,
            fullName: input.fullName,
            phone: input.phone,
          })
        : await this.users.createDbOnlyUser({
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
          });

      return await this.prisma.associationMembership.create({
        data: {
          associationId,
          userId: createdUser.id,
          role: input.role,
          titleId: input.titleId ?? null,
          customTitle: input.customTitle ?? null,
          isActive: true,
        },
        include: memberInclude,
      });
    } catch (e) {
      // Membership insert failed after the user was created — roll the
      // user back so we don't leave orphans (especially in Supabase).
      // Mirror `AssociationsService.create`: log rollback failures so
      // orphaned auth users are observable rather than silently hidden.
      if (createdUser) {
        try {
          await this.users.deleteUser({
            id: createdUser.id,
            supabaseUserId: createdUser.supabaseUserId,
          });
        } catch (rollbackErr) {
          this.logger.error(
            `Saga rollback failed for user ${createdUser.id}: ${
              (rollbackErr as Error).message
            }`,
          );
        }
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu dernek için belirtilen rol zaten aktif bir kişiye atanmış',
        );
      }
      throw e;
    }
  }

  async list(associationId: string, query: ListMembersQuery) {
    await this.ensureAssociation(associationId);

    const where: Prisma.AssociationMembershipWhereInput = {
      associationId,
      deletedAt: null,
    };

    if (query.role) {
      where.role = query.role;
    }

    // Default = active-only view. isActive=false means audit view (include left/inactive).
    if (query.isActive !== false) {
      where.isActive = true;
      where.leftAt = null;
    }

    return this.prisma.associationMembership.findMany({
      where,
      include: memberInclude,
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async update(
    associationId: string,
    membershipId: string,
    input: UpdateMemberInput,
  ) {
    await this.ensureMembership(associationId, membershipId);

    const data: Prisma.AssociationMembershipUpdateInput = {};
    if (input.role !== undefined) data.role = input.role;
    if (input.titleId !== undefined) {
      data.title = input.titleId
        ? { connect: { id: input.titleId } }
        : { disconnect: true };
    }
    if (input.customTitle !== undefined) data.customTitle = input.customTitle;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.leftAt !== undefined) {
      data.leftAt = input.leftAt ? new Date(input.leftAt) : null;
    }

    try {
      return await this.prisma.associationMembership.update({
        where: { id: membershipId },
        data,
        include: memberInclude,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bu dernek için belirtilen rol zaten aktif bir kişiye atanmış',
        );
      }
      throw e;
    }
  }

  async remove(associationId: string, membershipId: string) {
    await this.ensureMembership(associationId, membershipId);

    return this.prisma.associationMembership.update({
      where: { id: membershipId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
      include: memberInclude,
    });
  }

  async unlinkMemberTelegram(
    associationId: string,
    membershipId: string,
  ): Promise<{ unlinked: boolean }> {
    const membership = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { userId: true },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    return this.auth.unlinkTelegram(membership.userId);
  }

  // Admin-issued Telegram link code: a manager (or system admin) generates
  // a one-time code on behalf of a member, who then sends `/link <code>`
  // to the bot. Required for DB-only members (no Supabase login = cannot
  // self-issue from /settings/telegram).
  async generateTelegramLink(associationId: string, membershipId: string) {
    const membership = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { userId: true },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    return this.auth.generateLinkToken(membership.userId);
  }

  private async ensureAssociation(id: string) {
    const exists = await this.prisma.association.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Dernek bulunamadı');
  }

  // Scoped by `associationId` + `membershipId`: a membership that exists
  // but belongs to a different dernek is treated as not-found so the
  // route guard cannot be bypassed by passing a foreign membershipId.
  private async ensureMembership(associationId: string, membershipId: string) {
    const exists = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Üyelik bulunamadı');
  }
}
