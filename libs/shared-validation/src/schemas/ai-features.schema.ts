import { z } from 'zod';

export const meetingSummarySchema = z.object({
  summary: z.string().min(1),
  decisions: z.array(z.string()),
  discussionTopics: z.array(z.string()),
  attendeeCount: z.number().nullable(),
  tone: z.enum(['olumlu', 'nötr', 'gergin', 'acil']),
});

export type MeetingSummaryOutput = z.infer<typeof meetingSummarySchema>;

export const agendaItemSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1),
  priority: z.enum(['YUKSEK', 'ORTA', 'DUSUK']),
  category: z.enum([
    'inandıcı_karar',
    'bütçe',
    'etkinlik',
    'dış_iliskiler',
    'üye_yönetimi',
    'idari',
    'diğer',
  ]),
  estimatedDuration: z.number().int().min(5).max(480),
});

export const agendaSuggestionSchema = z.object({
  agendaItems: z.array(agendaItemSchema),
});

export type AgendaSuggestionOutput = z.infer<typeof agendaSuggestionSchema>;

export const prioritizedTaskSchema = z.object({
  taskId: z.string().min(1),
  priority: z.enum(['YUKSEK', 'ORTA', 'DUSUK']),
  reason: z.string().min(1),
});

export const prioritizeTasksResultSchema = z.object({
  prioritizedTasks: z.array(prioritizedTaskSchema),
});

export type PrioritizeTasksResultOutput = z.infer<typeof prioritizeTasksResultSchema>;

// ---------------------------------------------------------------------------
// Islamic event suggestions
// ---------------------------------------------------------------------------

export const islamicEventSuggestionItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(10).max(800),
  targetAudience: z.enum(['middle_school', 'high_school', 'general']),
  category: z.enum([
    'sohbet',
    'egitim',
    'kultur',
    'genclik',
    'aile',
    'sosyal_sorumluluk',
    'ibadet',
  ]),
  keyTopics: z.array(z.string().min(1)).min(1).max(6),
  resourcesNeeded: z.string().min(1).max(200),
  estimatedParticipants: z.string().min(1).max(60),
  islamicSession: z.object({
    title: z.string().min(1).max(120),
    description: z.string().min(10).max(400),
    duration: z.string().min(1).max(50),
  }),
});

export const islamicEventSuggestionSchema = z.object({
  suggestions: z.array(islamicEventSuggestionItemSchema).min(1).max(10),
});

export type IslamicEventSuggestionOutput = z.infer<typeof islamicEventSuggestionSchema>;

// ---------------------------------------------------------------------------
// Event schedule / program flow
// ---------------------------------------------------------------------------

export const scheduleItemSchema = z.object({
  time: z.string().min(1).max(10), // "14:00"
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300).optional(),
  duration: z.string().min(1).max(50), // "30 dk"
});

export const eventScheduleSchema = z.object({
  items: z.array(scheduleItemSchema).min(1).max(20),
});

export type EventScheduleOutput = z.infer<typeof eventScheduleSchema>;

// ---------------------------------------------------------------------------
// Social media content (Instagram)
// ---------------------------------------------------------------------------

export const socialContentSchema = z.object({
  instagramCaption: z.string().min(1).max(2200),
  hashtags: z.array(z.string().min(1)).min(3).max(15),
  storyText: z.string().min(1).max(300),
  posterTagline: z.string().min(1).max(100),
});

export type SocialContentOutput = z.infer<typeof socialContentSchema>;

// ---------------------------------------------------------------------------
// Recurring program (weekly series)
// ---------------------------------------------------------------------------

export const weeklySessionSchema = z.object({
  weekNumber: z.number().int().min(1).max(52),
  title: z.string().min(1).max(120),
  description: z.string().min(10).max(400),
  theme: z.string().min(1).max(100),
  keyTopics: z.array(z.string().min(1)).min(1).max(5),
});

export const recurringProgramSchema = z.object({
  programTitle: z.string().min(1).max(120),
  totalWeeks: z.number().int().min(2).max(12),
  description: z.string().min(10).max(500),
  sessions: z.array(weeklySessionSchema).min(2).max(12),
});

export type RecurringProgramOutput = z.infer<typeof recurringProgramSchema>;
