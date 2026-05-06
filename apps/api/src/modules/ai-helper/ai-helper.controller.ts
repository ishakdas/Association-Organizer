import { Body, Controller, Get, NotFoundException, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AiService } from '@ticketbot/ai';
import { AiHelperService } from './ai-helper.service';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { GenerateSocialDto } from './dto/generate-social.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreatePromptTemplateDto, UpdatePromptTemplateDto } from './dto/prompt-template.dto';

@Controller('ai')
@UseGuards(AuthGuard, SupabaseUserGuard)
@UsePipes(ZodValidationPipe)
export class AiHelperController {
  constructor(
    private readonly ai: AiService,
    private readonly helper: AiHelperService,
  ) {}

  @Post('generate-schedule')
  generateSchedule(@Body() body: GenerateScheduleDto) {
    return this.ai.generateEventSchedule(
      body.title,
      body.description,
      body.islamicSession,
      body.timeRange,
    );
  }

  @Post('generate-social')
  generateSocialContent(@Body() body: GenerateSocialDto) {
    return this.ai.generateInstagramContent(
      body.title,
      body.description,
      body.targetAudience,
      body.category,
      body.keyTopics,
      body.eventDate,
      body.location,
      body.startTime,
      body.endTime,
    );
  }

  // -------------------------------------------------------------------------
  // Feedback
  // -------------------------------------------------------------------------

  @Post('suggestions/:id/feedback')
  createFeedback(
    @Param('id') suggestionId: string,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.helper.createFeedback(suggestionId, dto);
  }

  @Get('suggestions/:id/feedback')
  async getFeedback(@Param('id') suggestionId: string) {
    try {
      return await this.helper.getFeedback(suggestionId);
    } catch {
      throw new NotFoundException('Feedback not found');
    }
  }

  // -------------------------------------------------------------------------
  // Prompt Templates
  // -------------------------------------------------------------------------

  @Get('prompt-templates')
  listPromptTemplates(@Query('key') key?: string) {
    return this.helper.listPromptTemplates(key);
  }

  @Get('prompt-templates/active')
  getActivePromptTemplate(@Query('key') key: string) {
    return this.helper.getActivePromptTemplate(key);
  }

  @Post('prompt-templates')
  createPromptTemplate(@Body() dto: CreatePromptTemplateDto) {
    return this.helper.createPromptTemplate(dto);
  }

  @Put('prompt-templates/:id')
  updatePromptTemplate(
    @Param('id') id: string,
    @Body() dto: UpdatePromptTemplateDto,
  ) {
    return this.helper.updatePromptTemplate(id, dto);
  }
}
