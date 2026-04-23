import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@ticketbot/database';

export interface ListFilters {
  search?: string;
  city?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

@Injectable()
export class AssociationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTaxNumber(taxNumber: string) {
    return this.prisma.association.findFirst({
      where: { taxNumber, deletedAt: null },
    });
  }

  findById(id: string) {
    return this.prisma.association.findFirst({
      where: { id, deletedAt: null },
    });
  }

  create(data: Prisma.AssociationUncheckedCreateInput) {
    return this.prisma.association.create({ data });
  }

  async list(filters: ListFilters) {
    const { search, city, isActive, page, pageSize } = filters;

    const where: Prisma.AssociationWhereInput = {
      deletedAt: null,
      ...(city && { city: { equals: city, mode: 'insensitive' } }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { shortName: { contains: search, mode: 'insensitive' } },
          { taxNumber: { contains: search } },
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
}
