import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';

@Injectable()
export class TitlesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.memberTitleDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
      },
    });
  }
}
