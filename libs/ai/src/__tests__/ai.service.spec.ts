import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../ai.service';
import { AI_PROVIDER } from '../ai-provider.interface';
import { FakeAiProvider } from '../providers/fake.provider';

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

  it('should extract action items from meeting notes', async () => {
    fakeProvider.setResponse('extractActionItems', {
      actionItems: [
        {
          title: 'Review PR #123 for authentication changes',
          description: null,
          assignedToUserId: 'user-john',
        },
        {
          title: 'Update API documentation for new endpoints',
          description: null,
          assignedToUserId: 'user-jane',
        },
        {
          title: 'Schedule load testing for next sprint',
          description: null,
          assignedToUserId: null,
        },
      ],
    });

    const result = await service.extractActionItems(
      'Meeting notes: John will review PR #123. Jane needs to update the API docs. We should schedule load testing next sprint.',
      'John (id=user-john), Jane (id=user-jane)',
    );

    expect(result.actionItems).toHaveLength(3);
    expect(result.actionItems[0].title).toBe('Review PR #123 for authentication changes');
    expect(result.actionItems[0].assignedToUserId).toBe('user-john');
    expect(result.actionItems[1].assignedToUserId).toBe('user-jane');
    expect(result.actionItems[2].assignedToUserId).toBeNull();
  });

  it('should handle empty action items', async () => {
    fakeProvider.setResponse('extractActionItems', {
      actionItems: [],
    });

    const result = await service.extractActionItems(
      'Just a casual chat, no action items.',
      '',
    );
    expect(result.actionItems).toHaveLength(0);
  });

  it('should throw when no response is configured', async () => {
    // Don't configure a response — should throw
    await expect(service.extractActionItems('Some notes', '')).rejects.toThrow(
      'FakeAiProvider: no response configured',
    );
  });
});
