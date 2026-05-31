import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import {
  CreateDonationCategoryInput,
  UpdateDonationCategoryInput,
  slugifyTr,
} from '@ticketbot/shared-validation';

@Injectable()
export class DonationCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(options: { includeInactive?: boolean } = {}) {
    return this.prisma.donationCategoryDefinition.findMany({
      where: options.includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        isActive: true,
      },
    });
  }

  async create(input: CreateDonationCategoryInput) {
    const slug = await this.uniqueSlug(slugifyTr(input.name));
    return this.prisma.donationCategoryDefinition.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  }

  async update(id: string, input: UpdateDonationCategoryInput) {
    await this.ensureExists(id);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.donationCategoryDefinition.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.donationCategoryDefinition.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.donationCategoryDefinition.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Bağış kategorisi bulunamadı');
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let n = 1;
    while (n < 100) {
      const exists = await this.prisma.donationCategoryDefinition.findUnique({
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
