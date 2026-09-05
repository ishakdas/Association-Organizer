import { PendingUserCleanupService } from './pending-user-cleanup.service';

describe('PendingUserCleanupService environment isolation', () => {
  const prisma = { user: { findMany: jest.fn() } };
  const supabase = { getAuthClient: jest.fn() };
  const config = { get: jest.fn(() => false) };

  beforeEach(() => jest.clearAllMocks());

  it('does not query users when jobs are disabled', async () => {
    const service = new PendingUserCleanupService(
      prisma as never,
      supabase as never,
      config as never,
    );

    service.onModuleInit();
    await service.executeCleanup();

    expect(config.get).toHaveBeenCalledWith('jobs.enabled');
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(supabase.getAuthClient).not.toHaveBeenCalled();
  });
});
