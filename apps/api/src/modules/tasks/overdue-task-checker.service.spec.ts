import { OverdueTaskChecker } from './overdue-task-checker.service';

describe('OverdueTaskChecker environment isolation', () => {
  const prisma = { task: { findMany: jest.fn() } };
  const notifications = {
    notifyOverdueTasks: jest.fn(),
    notifyUnresolvedDisputes: jest.fn(),
  };
  const config = { get: jest.fn(() => false) };

  beforeEach(() => jest.clearAllMocks());

  it('does not run checks when disabled', async () => {
    const service = new OverdueTaskChecker(
      prisma as never,
      notifications as never,
      config as never,
    );

    service.onModuleInit();
    await service.checkOverdueTasks();
    await service.checkUnresolvedDisputes();

    expect(config.get).toHaveBeenCalledWith('jobs.overdueCheckerEnabled');
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(notifications.notifyOverdueTasks).not.toHaveBeenCalled();
    expect(notifications.notifyUnresolvedDisputes).not.toHaveBeenCalled();
  });
});
