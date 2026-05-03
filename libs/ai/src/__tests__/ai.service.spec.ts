import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../ai.service';
import { AI_PROVIDER } from '../ai-provider.interface';
import { FakeAiProvider } from '../providers/fake.provider';
import { z } from 'zod';

const testSchema = z.object({
  actionItems: z.array(
    z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(2000).nullable(),
      assignedToUserId: z.string().nullable(),
      dueDateText: z.string().nullable(),
    }),
  ),
});

describe('AiService', () => {
  let service: AiService;
  let fakeProvider: FakeAiProvider;

  beforeEach(async () => {
    fakeProvider = new FakeAiProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AI_PROVIDER, useValue: fakeProvider },
        AiService,
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should extract action items with dueDateText', async () => {
    fakeProvider.setResponse('extractActionItems', {
      actionItems: [
        { title: 'Review PR #123', description: null, assignedToUserId: 'user-1', dueDateText: '15 Mayıs 2026' },
        { title: 'Update API docs', description: null, assignedToUserId: 'user-2', dueDateText: 'gelecek hafta' },
        { title: 'Schedule load testing', description: null, assignedToUserId: null, dueDateText: null },
      ],
    });

    const result = await service.extractActionItems(
      'Meeting notes: John will review PR #123.',
      '- User ID: user-1\n  İsim: John',
    );

    expect(result.actionItems).toHaveLength(3);
    expect(result.actionItems[0].title).toBe('Review PR #123');
    expect(result.actionItems[0].assignedToUserId).toBe('user-1');
    expect(result.actionItems[2].assignedToUserId).toBeNull();
  });

  it('should handle empty action items', async () => {
    fakeProvider.setResponse('extractActionItems', {
      actionItems: [],
    });

    const result = await service.extractActionItems('Just a casual chat, no action items.', '');
    expect(result.actionItems).toHaveLength(0);
  });

  it('should throw when no response is configured', async () => {
    await expect(service.extractActionItems('Some notes', '')).rejects.toThrow(
      'FakeAiProvider: no response configured',
    );
  });

  it('schema should include dueDateText field', () => {
    const parsed = testSchema.parse({
      actionItems: [
        { title: 'Test', description: null, assignedToUserId: null, dueDateText: '15 Mayıs' },
        { title: 'No date', description: null, assignedToUserId: 'u1', dueDateText: null },
      ],
    });
    expect(parsed.actionItems[0].dueDateText).toBe('15 Mayıs');
    expect(parsed.actionItems[1].dueDateText).toBeNull();
  });
});