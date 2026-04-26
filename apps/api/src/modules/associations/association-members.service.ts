import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  Prisma,
  UserRole,
  type User,
} from '@ticketbot/database';
import {
  AddMemberInput,
  ListMembersQuery,
  UpdateMemberInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

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
        include: { user: true, title: true },
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
      include: { user: true, title: true },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async update(
    associationId: string,
    membershipId: string,
    input: UpdateMemberInput,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.ensureMembership(associationId, membershipId);

    // Yalnızca SYSTEM_ADMIN bir başkanı görevden alabilir veya bir
    // üyeyi başkan yapabilir. Mevcut rolü MANAGER olan bir üyeliğin
    // değiştirilmesi (demote) ve yeni rolü MANAGER yapma (promote) bu
    // kapsamdadır — başkan kendisini de görevden alamaz.
    const touchesManager =
      existing.role === UserRole.ASSOCIATION_MANAGER ||
      input.role === UserRole.ASSOCIATION_MANAGER;
    if (touchesManager && actor.systemRole !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Başkanlık rolünü yalnızca sistem yöneticisi değiştirebilir',
      );
    }

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
        include: { user: true, title: true },
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

  async remove(
    associationId: string,
    membershipId: string,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.ensureMembership(associationId, membershipId);

    if (
      existing.role === UserRole.ASSOCIATION_MANAGER &&
      actor.systemRole !== UserRole.SYSTEM_ADMIN
    ) {
      throw new ForbiddenException(
        'Başkanı yalnızca sistem yöneticisi görevden alabilir',
      );
    }

    return this.prisma.associationMembership.update({
      where: { id: membershipId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
      include: { user: true, title: true },
    });
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
  // Returns `role` so callers can enforce role-specific gates (e.g.
  // only SYSTEM_ADMIN may mutate a MANAGER row).
  private async ensureMembership(associationId: string, membershipId: string) {
    const found = await this.prisma.associationMembership.findFirst({
      where: { id: membershipId, associationId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!found) throw new NotFoundException('Üyelik bulunamadı');
    return found;
  }
}
