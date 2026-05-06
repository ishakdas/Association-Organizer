import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreatePromptTemplateDto, UpdatePromptTemplateDto } from './dto/prompt-template.dto';

@Injectable()
export class AiHelperService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  async createFeedback(suggestionId: string, dto: CreateFeedbackDto) {
    const suggestion = await this.prisma.aiSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    return this.prisma.aiSuggestionFeedback.upsert({
      where: { suggestionId },
      create: {
        suggestionId,
        rating: dto.rating,
        isHelpful: dto.isHelpful ?? null,
        comment: dto.comment ?? null,
        likedCategories: dto.likedCategories ?? [],
        dislikedCategories: dto.dislikedCategories ?? [],
      },
      update: {
        rating: dto.rating,
        isHelpful: dto.isHelpful ?? null,
        comment: dto.comment ?? null,
        likedCategories: dto.likedCategories ?? [],
        dislikedCategories: dto.dislikedCategories ?? [],
      },
    });
  }

  async getFeedback(suggestionId: string) {
    const feedback = await this.prisma.aiSuggestionFeedback.findUnique({
      where: { suggestionId },
    });
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }
    return feedback;
  }

  // ---------------------------------------------------------------------------
  // Prompt Templates
  // ---------------------------------------------------------------------------

  async listPromptTemplates(key?: string) {
    return this.prisma.promptTemplate.findMany({
      where: {
        ...(key ? { key } : {}),
      },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async getActivePromptTemplate(key: string) {
    return this.prisma.promptTemplate.findFirst({
      where: { key, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  async createPromptTemplate(dto: CreatePromptTemplateDto) {
    const latest = await this.prisma.promptTemplate.findFirst({
      where: { key: dto.key },
      orderBy: { version: 'desc' },
    });

    const version = dto.version ?? (latest ? latest.version + 1 : 1);

    return this.prisma.promptTemplate.create({
      data: {
        key: dto.key,
        version,
        content: dto.content,
      },
    });
  }

  async updatePromptTemplate(id: string, dto: UpdatePromptTemplateDto) {
    return this.prisma.promptTemplate.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
