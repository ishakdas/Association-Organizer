import { BotService } from './bot.service';

describe('BotService environment isolation', () => {
  const config = {
    get: jest.fn((key: string) => (key === 'bot.enabled' ? false : undefined)),
  };
  const prisma = {
    telegramAccount: { findUnique: jest.fn() },
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not initialize Telegram when disabled', async () => {
    const service = new BotService(config as never, prisma as never, {} as never);

    await service.onModuleInit();

    expect(service.isEnabled()).toBe(false);
    expect(config.get).toHaveBeenCalledWith('bot.enabled');
  });

  it('does not query or send when disabled', async () => {
    const service = new BotService(config as never, prisma as never, {} as never);

    await expect(service.sendToUser('user-1', 'message')).resolves.toBe(false);
    expect(prisma.telegramAccount.findUnique).not.toHaveBeenCalled();
  });

  it('rejects direct bot access when disabled', () => {
    const service = new BotService(config as never, prisma as never, {} as never);

    expect(() => service.getBot()).toThrow('Telegram bot is disabled');
  });
});
