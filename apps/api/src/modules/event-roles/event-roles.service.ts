import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, Prisma } from '@ticketbot/database';
import type {
  CreateEventRoleInput,
  UpdateEventRoleInput,
  ListEventRolesQuery,
} from '@ticketbot/shared-validation';

@Injectable()
export class EventRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(associationId: string, input: CreateEventRoleInput) {
    try {
      const created = await this.prisma.eventRoleDefinition.create({
        data: {
          associationId,
          name: input.name,
          description: input.description ?? null,
          sortOrder: input.sortOrder,
        },
      });
      return this.toDto(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Bu isimde bir rol zaten var');
      }
      throw err;
    }
  }

  async list(associationId: string, query: ListEventRolesQuery) {
    const where: Prisma.EventRoleDefinitionWhereInput = { associationId };
    if (!query.includeDeleted) where.deletedAt = null;

    const rows = await this.prisma.eventRoleDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toDto(r));
  }

  async get(associationId: string, id: string) {
    const row = await this.prisma.eventRoleDefinition.findFirst({
      where: { id, associationId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Rol bulunamadı');
    return this.toDto(row);
  }

  async update(
    associationId: string,
    id: string,
    input: UpdateEventRoleInput,
  ) {
    const existing = await this.prisma.eventRoleDefinition.findFirst({
      where: { id, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Rol bulunamadı');

    const data: Prisma.EventRoleDefinitionUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined)
      data.description = input.description ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    try {
      const updated = await this.prisma.eventRoleDefinition.update({
        where: { id },
        data,
      });
      return this.toDto(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Bu isimde bir rol zaten var');
      }
      throw err;
    }
  }

  async softDelete(associationId: string, id: string) {
    const existing = await this.prisma.eventRoleDefinition.findFirst({
      where: { id, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Rol bulunamadı');

    await this.prisma.eventRoleDefinition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  private toDto(row: {
    id: string;
    associationId: string;
    name: string;
    description: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      associationId: row.associationId,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
