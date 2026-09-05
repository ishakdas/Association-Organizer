import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

jest.mock('./templates/index', () => ({
  renderMagicLinkTemplate: jest.fn().mockResolvedValue('<html></html>'),
  renderWelcomeTemplate: jest.fn().mockResolvedValue('<html></html>'),
  renderTelegramLinkTemplate: jest.fn().mockResolvedValue('<html></html>'),
}));

describe('EmailService environment isolation', () => {
  const configValues = new Map<string, unknown>();
  const config = { get: jest.fn((key: string) => configValues.get(key)) };
  const prisma = {
    emailLog: { create: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.clear();
    configValues.set('resend.mode', 'log');
  });

  it('does not deliver or persist email in log mode', async () => {
    const service = new EmailService(config as never, prisma as never);

    await service.onModuleInit();
    const result = await service.sendMagicLink(
      'developer@example.com',
      'Developer',
      'http://localhost:3001/callback',
    );

    expect(result).toEqual({ messageId: null, previewUrl: null });
    expect(prisma.emailLog.create).not.toHaveBeenCalled();
  });

  it('delivers local email through Mailpit SMTP', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mailpit-message-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    configValues.set('resend.mode', 'mailpit');
    configValues.set('resend.fromName', 'Local App');
    configValues.set('smtp.host', '127.0.0.1');
    configValues.set('smtp.port', 54325);
    configValues.set('smtp.previewUrl', 'http://127.0.0.1:54324');
    const service = new EmailService(config as never, prisma as never);

    await service.onModuleInit();
    const result = await service.sendMagicLink(
      'developer@example.com',
      'Developer',
      'http://localhost:3001/callback',
    );

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 54325,
      secure: false,
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Local App <no-reply@association-organizer.local>',
        to: 'developer@example.com',
      }),
    );
    expect(prisma.emailLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'SENT',
        resendId: 'mailpit-message-id',
      }),
    });
    expect(result).toEqual({
      messageId: 'mailpit-message-id',
      previewUrl: 'http://127.0.0.1:54324',
    });
  });
});
