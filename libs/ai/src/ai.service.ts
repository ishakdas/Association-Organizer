import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';
import { extractionResultSchema, ExtractionResultOutput } from '@ticketbot/shared-validation';
import {
  EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from './prompts/extract-action-items.prompt';

@Injectable()
export class AiService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  async extractActionItems(meetingNotes: string, membersContext: string): Promise<ExtractionResultOutput> {
    return this.provider.generateStructured({
      systemPrompt: EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT,
      userPrompt: buildExtractionUserPrompt(meetingNotes, membersContext),
      schema: extractionResultSchema,
      schemaName: 'extractActionItems',
    });
  }
}
