import {
  Injectable,
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

@Injectable()
export class AssociationMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
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
      if (createdUser) {
        await this.users
          .deleteUser({
            id: createdUser.id,
            supabaseUserId: createdUser.supabaseUserId,
          })
          .catch(() => undefined);
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

  async update(membershipId: string, input: UpdateMemberInput) {
    await this.ensureMembership(membershipId);

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

  async remove(membershipId: string) {
    await this.ensureMembership(membershipId);

    return this.prisma.associationMembership.update({
      where: { id: membershipId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
      include: { user: true, title: true },
    });
  }

  private async ensureAssociation(id: string) {
    const exists = await this.prisma.association.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Dernek bulunamadı');
  }

  private async ensureMembership(id: string) {
    const exists = await this.prisma.associationMembership.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Üyelik bulunamadı');
  }
}
