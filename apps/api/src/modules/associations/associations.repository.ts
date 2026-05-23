import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@ticketbot/database';

export interface FindManyFilters {
  search?: string;
  city?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
  /** When set, restrict to associations the user has an active membership in. */
  scopedToUserId?: string;
}

@Injectable()
export class AssociationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AssociationUncheckedCreateInput) {
    return this.prisma.association.create({ data });
  }

  async findById(id: string) {
    const a = await this.prisma.association.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        shortName: true,
        taxNumber: true,
        foundedAt: true,
        address: true,
        city: true,
        district: true,
        phone: true,
        email: true,
        website: true,
        logoUrl: true,
        activityArea: true,
        memberCount: true,
        isActive: true,
        notes: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        _count: {
          select: {
            memberships: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      },
    });
    if (!a) return null;
    return { ...a, memberCount: a._count.memberships };
  }

  async findMany(filters: FindManyFilters) {
    const { search, city, isActive, page, pageSize, scopedToUserId } = filters;

    const where: Prisma.AssociationWhereInput = {
      deletedAt: null,
      ...(city && { city: { equals: city, mode: 'insensitive' } }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { taxNumber: { contains: search } },
          { shortName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(scopedToUserId && {
        memberships: {
          some: {
            userId: scopedToUserId,
            isActive: true,
            deletedAt: null,
          },
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.association.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          shortName: true,
          taxNumber: true,
          foundedAt: true,
          address: true,
          city: true,
          district: true,
          phone: true,
          email: true,
          website: true,
          logoUrl: true,
          activityArea: true,
          memberCount: true,
          isActive: true,
          notes: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          _count: {
            select: {
              memberships: {
                where: { isActive: true, deletedAt: null },
              },
            },
          },
        },
      }),
      this.prisma.association.count({ where }),
    ]);

    const enriched = data.map((a) => ({
      ...a,
      memberCount: a._count.memberships,
    }));

    return { data: enriched, total };
  }

  async existsByTaxNumber(taxNumber: string): Promise<boolean> {
    const row = await this.prisma.association.findUnique({
      where: { taxNumber },
      select: { id: true },
    });
    return row !== null;
  }
}
