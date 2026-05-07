import { Inject, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';
import {
  extractionResultSchema,
  ExtractionResultOutput,
  meetingSummarySchema,
  MeetingSummaryOutput,
  agendaSuggestionSchema,
  AgendaSuggestionOutput,
  prioritizeTasksResultSchema,
  PrioritizeTasksResultOutput,
  islamicEventSuggestionSchema,
  IslamicEventSuggestionOutput,
  eventScheduleSchema,
  EventScheduleOutput,
  socialContentSchema,
  SocialContentOutput,
  recurringProgramSchema,
  RecurringProgramOutput,
} from '@ticketbot/shared-validation';
import {
  EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from './prompts/extract-action-items.prompt';
import {
  SUMMARIZE_MEETING_SYSTEM_PROMPT,
  buildSummarizeUserPrompt,
} from './prompts/summarize-meeting.prompt';
import {
  SUGGEST_AGENDA_SYSTEM_PROMPT,
  buildAgendaUserPrompt,
} from './prompts/suggest-agenda.prompt';
import {
  PRIORITIZE_TASKS_SYSTEM_PROMPT,
  buildPrioritizeUserPrompt,
} from './prompts/prioritize-tasks.prompt';
import {
  SUGGEST_ISLAMIC_EVENTS_SYSTEM_PROMPT,
  buildIslamicEventsUserPrompt,
} from './prompts/suggest-islamic-events.prompt';
import {
  GENERATE_EVENT_SCHEDULE_SYSTEM_PROMPT,
  buildEventScheduleUserPrompt,
} from './prompts/generate-event-schedule.prompt';
import {
  GENERATE_INSTAGRAM_CONTENT_SYSTEM_PROMPT,
  buildInstagramContentUserPrompt,
} from './prompts/generate-instagram-content.prompt';
import {
  GENERATE_RECURRING_PROGRAM_SYSTEM_PROMPT,
  buildRecurringProgramUserPrompt,
} from './prompts/generate-recurring-program.prompt';
import { PROMPT_TEMPLATE_LOADER, PromptTemplateLoader } from './prompt-template-loader.interface';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Optional()
    @Inject(PROMPT_TEMPLATE_LOADER)
    private readonly promptLoader: PromptTemplateLoader | null,
  ) {}

  private async getSystemPrompt(key: string, fallback: string): Promise<string> {
    if (!this.promptLoader) return fallback;
    try {
      const loaded = await this.promptLoader.getPrompt(key);
      return loaded ?? fallback;
    } catch {
      return fallback;
    }
  }

  async extractActionItems(meetingNotes: string, membersContext: string): Promise<ExtractionResultOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('extract-action-items', EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT),
      userPrompt: buildExtractionUserPrompt(meetingNotes, membersContext),
      schema: extractionResultSchema,
      schemaName: 'extractActionItems',
    }) as Promise<ExtractionResultOutput>;
  }

  async summarizeMeeting(meetingNotes: string): Promise<MeetingSummaryOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('summarize-meeting', SUMMARIZE_MEETING_SYSTEM_PROMPT),
      userPrompt: buildSummarizeUserPrompt(meetingNotes),
      schema: meetingSummarySchema,
      schemaName: 'summarizeMeeting',
    }) as Promise<MeetingSummaryOutput>;
  }

  async suggestAgenda(meetingNotes: string, pendingTasks?: string): Promise<AgendaSuggestionOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('suggest-agenda', SUGGEST_AGENDA_SYSTEM_PROMPT),
      userPrompt: buildAgendaUserPrompt(meetingNotes, pendingTasks),
      schema: agendaSuggestionSchema,
      schemaName: 'suggestAgenda',
    }) as Promise<AgendaSuggestionOutput>;
  }

  async prioritizeTasks(tasksContext: string): Promise<PrioritizeTasksResultOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('prioritize-tasks', PRIORITIZE_TASKS_SYSTEM_PROMPT),
      userPrompt: buildPrioritizeUserPrompt(tasksContext),
      schema: prioritizeTasksResultSchema,
      schemaName: 'prioritizeTasks',
    }) as Promise<PrioritizeTasksResultOutput>;
  }

  async suggestIslamicEvents(
    period: 'weekly' | 'monthly',
    targetAudience: 'all' | 'middle_school' | 'high_school',
    currentDate: string,
    pastEventTitles: string[],
    associationProfile?: {
      memberCount: number;
      city: string;
      pastCategoryBreakdown: Record<string, number>;
      averageAttendance?: number;
    },
    upcomingHolidays?: { name: string; date: string; daysUntil: number }[],
  ): Promise<IslamicEventSuggestionOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('suggest-islamic-events', SUGGEST_ISLAMIC_EVENTS_SYSTEM_PROMPT),
      userPrompt: buildIslamicEventsUserPrompt(
        period,
        targetAudience,
        currentDate,
        pastEventTitles,
        associationProfile,
        upcomingHolidays,
      ),
      schema: islamicEventSuggestionSchema,
      schemaName: 'suggestIslamicEvents',
    }) as Promise<IslamicEventSuggestionOutput>;
  }

  async generateEventSchedule(
    title: string,
    description: string,
    islamicSession: { title: string; description: string; duration: string },
    timeRange: { start: string; end: string },
  ): Promise<EventScheduleOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('generate-event-schedule', GENERATE_EVENT_SCHEDULE_SYSTEM_PROMPT),
      userPrompt: buildEventScheduleUserPrompt(
        title,
        description,
        islamicSession.title,
        islamicSession.description,
        islamicSession.duration,
        timeRange.start,
        timeRange.end,
      ),
      schema: eventScheduleSchema,
      schemaName: 'generateEventSchedule',
    }) as Promise<EventScheduleOutput>;
  }

  async generateInstagramContent(
    title: string,
    description: string,
    targetAudience: string,
    category: string,
    keyTopics: string[],
    eventDate: string,
    location: string,
    startTime: string,
    endTime: string,
  ): Promise<SocialContentOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('generate-instagram-content', GENERATE_INSTAGRAM_CONTENT_SYSTEM_PROMPT),
      userPrompt: buildInstagramContentUserPrompt(
        title,
        description,
        targetAudience,
        category,
        keyTopics,
        eventDate,
        location,
        startTime,
        endTime,
      ),
      schema: socialContentSchema,
      schemaName: 'generateInstagramContent',
    }) as Promise<SocialContentOutput>;
  }

  async generateRecurringProgram(
    title: string,
    description: string,
    targetAudience: string,
    category: string,
    keyTopics: string[],
    weeks: number,
  ): Promise<RecurringProgramOutput> {
    return this.provider.generateStructured({
      systemPrompt: await this.getSystemPrompt('generate-recurring-program', GENERATE_RECURRING_PROGRAM_SYSTEM_PROMPT),
      userPrompt: buildRecurringProgramUserPrompt(
        title,
        description,
        targetAudience,
        category,
        keyTopics,
        weeks,
      ),
      schema: recurringProgramSchema,
      schemaName: 'generateRecurringProgram',
    }) as Promise<RecurringProgramOutput>;
  }

  // ---------------------------------------------------------------------------
  // Multi-stage generation: brainstorm → critique → refine
  // ---------------------------------------------------------------------------

  async brainstormAndRefine<T>(
    context: string,
    systemPrompt: string,
    schema: z.ZodSchema<T>,
    schemaName: string,
    temperature?: number,
  ): Promise<T> {
    // Stage 1: Brainstorm raw ideas (no JSON constraint — free text)
    const brainstormText = await this.provider.generateText({
      systemPrompt: `Sen yaratıcı bir fikir üreticisisin. Kurallara bağlı kalmadan, mümkün olduğunca çeşitli ve özgün fikirler üret. ${systemPrompt}`,
      userPrompt: `${context}\n\nGörev: Yukarıdaki konu için 8-12 farklı, yaratıcı ve çeşitli fikir üret. Her fikir kısa (1-2 cümle) olsun. Standart ve klişe fikirlerden KAÇIN. Farklı mekanlar, formatlar, yaklaşımlar dene. Sadece numaralandırılmış liste ver, JSON kullanma.`,
      temperature: (temperature ?? 0.85) + 0.05,
    });

    // Stage 2: Critique — filter, merge, improve
    const critiqueText = await this.provider.generateText({
      systemPrompt: `Sen yapıcı bir editör ve eleştirmensin. Amacın: fikir listesini analiz edip en güçlü, en uygulanabilir ve en çeşitli fikirleri seçmek.`,
      userPrompt: `Aşağıdaki fikir listesini analiz et:\n${brainstormText}\n\nGörevler:\n1. Hangi fikirler çok benzer veya klişe? Onları birleştir veya çıkar.\n2. Hangi fikirler en yaratıcı, en uygulanabilir ve hedef kitleye en uygun?\n3. En iyi 4-6 fikri seç ve nedenini kısaca açıkla.\n4. Seçilen fikirleri biraz daha detaylandır: hedef kitle, kategori, tahmini süre.\n\nSadece metin olarak yanıt ver, JSON kullanma.`,
      temperature: (temperature ?? 0.85) - 0.1,
    });

    // Stage 3: Refine into structured JSON
    return this.provider.generateStructured({
      systemPrompt,
      userPrompt: `${context}\n\n--- YARATICI SÜREÇ SONUCU ---\nEleştirmen tarafından seçilen ve detaylandırılan en iyi fikirler:\n${critiqueText}\n\nŞimdi bu fikirleri yukarıdaki JSON şemasına göre detaylandırarak nihai çıktıyı üret.`,
      schema,
      schemaName,
      temperature: temperature ?? 0.85,
    }) as Promise<T>;
  }

  async suggestIslamicEventsWithChainOfThought(
    period: 'weekly' | 'monthly',
    targetAudience: 'all' | 'middle_school' | 'high_school',
    currentDate: string,
    pastEventTitles: string[],
    associationProfile?: {
      memberCount: number;
      city: string;
      pastCategoryBreakdown: Record<string, number>;
      averageAttendance?: number;
    },
    upcomingHolidays?: { name: string; date: string; daysUntil: number }[],
  ): Promise<IslamicEventSuggestionOutput> {
    const userPrompt = buildIslamicEventsUserPrompt(
      period,
      targetAudience,
      currentDate,
      pastEventTitles,
      associationProfile,
      upcomingHolidays,
    );

    const systemPrompt = await this.getSystemPrompt('suggest-islamic-events', SUGGEST_ISLAMIC_EVENTS_SYSTEM_PROMPT);

    return this.brainstormAndRefine(
      userPrompt,
      systemPrompt,
      islamicEventSuggestionSchema,
      'suggestIslamicEvents',
    );
  }
}
