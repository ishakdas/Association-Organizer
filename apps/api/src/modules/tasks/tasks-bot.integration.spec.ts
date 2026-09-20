import { TasksBotIntegration } from './tasks-bot.integration';

describe('TasksBotIntegration environment isolation', () => {
  it('does not register handlers when the bot is disabled', () => {
    const bot = {
      isEnabled: jest.fn(() => false),
      getBot: jest.fn(),
      setTaskCreatePort: jest.fn(),
      setTaskCreateManyPort: jest.fn(),
    };
    const integration = new TasksBotIntegration(
      bot as never,
      {} as never,
      {} as never,
      {} as never,
    );

    integration.onModuleInit();

    expect(bot.getBot).not.toHaveBeenCalled();
    expect(bot.setTaskCreatePort).not.toHaveBeenCalled();
    expect(bot.setTaskCreateManyPort).not.toHaveBeenCalled();
  });
});
