import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import {
  CreateMemberTitleInput,
  UpdateMemberTitleInput,
  slugifyTr,
} from '@ticketbot/shared-validation';

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
        isActive: true,
      },
    });
  }

  async create(input: CreateMemberTitleInput) {
    const slug = await this.uniqueSlug(slugifyTr(input.name));
    return this.prisma.memberTitleDefinition.create({
      data: {
        name: input.name,
        slug,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  }

  async update(id: string, input: UpdateMemberTitleInput) {
    await this.ensureExists(id);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.memberTitleDefinition.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.memberTitleDefinition.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.memberTitleDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Unvan bulunamadı');
  }

  /**
   * Walk the suffix counter (base, -2, -3, …) until a free slug is
   * found. Bounded at 100 to avoid pathological loops; the @unique
   * constraint on `slug` is the ultimate safety net.
   */
  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 1;
    while (n < 100) {
      const exists = await this.prisma.memberTitleDefinition.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }
}
