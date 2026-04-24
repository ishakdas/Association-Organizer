import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@ticketbot/database';

export interface FindManyFilters {
  search?: string;
  city?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

@Injectable()
export class AssociationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AssociationUncheckedCreateInput) {
    return this.prisma.association.create({ data });
  }

  findById(id: string) {
    return this.prisma.association.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findMany(filters: FindManyFilters) {
    const { search, city, isActive, page, pageSize } = filters;

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
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.association.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.association.count({ where }),
    ]);

    return { data, total };
  }

  async existsByTaxNumber(taxNumber: string): Promise<boolean> {
    const row = await this.prisma.association.findUnique({
      where: { taxNumber },
      select: { id: true },
    });
    return row !== null;
  }
}
