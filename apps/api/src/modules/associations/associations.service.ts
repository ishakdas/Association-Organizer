import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService, UserRole } from '@ticketbot/database';
import {
  CreateAssociationInput,
  ListAssociationsQuery,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { AssociationsRepository } from './associations.repository';
import { UsersService } from '../users/users.service';

@Injectable()
export class AssociationsService {
  private readonly logger = new Logger(AssociationsService.name);

  constructor(
    private readonly repository: AssociationsRepository,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Saga: tax-number pre-check → Supabase + local user → tx { assoc +
   * membership } → on tx failure undo the user we just created. If the
   * Supabase step itself fails, there's nothing to undo.
   */
  async create(input: CreateAssociationInput, createdById: string) {
    const { manager, ...associationData } = input;

    const exists = await this.repository.existsByTaxNumber(input.taxNumber);
    if (exists) {
      throw new ConflictException(
        'Bu vergi numarasıyla kayıtlı bir dernek zaten mevcut',
      );
    }

    const managerUser = await this.users.createSupabaseUser({
      email: manager.email,
      password: manager.password,
      fullName: manager.fullName,
      phone: manager.phone,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const association = await tx.association.create({
          data: {
            ...associationData,
            foundedAt: new Date(associationData.foundedAt),
            createdById,
          },
        });

        await tx.associationMembership.create({
          data: {
            userId: managerUser.id,
            associationId: association.id,
            role: UserRole.ASSOCIATION_MANAGER,
            isActive: true,
          },
        });

        return association;
      });
    } catch (e) {
      try {
        await this.users.deleteUser({
          id: managerUser.id,
          supabaseUserId: managerUser.supabaseUserId,
        });
      } catch (rollbackErr) {
        this.logger.error(
          `Saga rollback failed for user ${managerUser.id}: ${
            (rollbackErr as Error).message
          }`,
        );
      }
      throw e;
    }
  }

  async findOne(id: string) {
    const association = await this.repository.findById(id);
    if (!association) throw new NotFoundException('Dernek bulunamadı');
    return association;
  }

  async list(query: ListAssociationsQuery, user: AuthenticatedUser) {
    const scopedToUserId =
      user.systemRole === UserRole.SYSTEM_ADMIN ? undefined : user.id;

    const { data, total } = await this.repository.findMany({
      ...query,
      scopedToUserId,
    });
    const { page, pageSize } = query;
    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
