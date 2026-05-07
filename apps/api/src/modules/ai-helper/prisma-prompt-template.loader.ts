import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import { PromptTemplateLoader } from '@ticketbot/ai';

@Injectable()
export class PrismaPromptTemplateLoader implements PromptTemplateLoader {
  constructor(private readonly prisma: PrismaService) {}

  async getPrompt(key: string): Promise<string | null> {
    const template = await this.prisma.promptTemplate.findFirst({
      where: { key, isActive: true },
      orderBy: { version: 'desc' },
    });
    return template?.content ?? null;
  }
}
