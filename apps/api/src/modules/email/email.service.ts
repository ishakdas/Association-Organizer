import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, EmailStatus } from '@ticketbot/database';
import { Resend } from 'resend';
import {
  renderMagicLinkTemplate,
  renderWelcomeTemplate,
  renderTelegramLinkTemplate,
} from './templates/index';

export interface SendEmailResult {
  messageId: string | null;
  previewUrl: string | null;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private client: Resend | null = null;
  private fromEmail = '';
  private fromName = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const apiKey = this.config.get<string>('resend.apiKey');
    const fromEmail = this.config.get<string>('resend.fromEmail');
    const fromName = this.config.get<string>('resend.fromName') ?? 'Defter-i Hilal';

    if (apiKey && fromEmail) {
      this.client = new Resend(apiKey);
      this.fromEmail = fromEmail;
      this.fromName = fromName;
      this.logger.log(`Resend aktif — gönderen: ${fromName} <${fromEmail}>`);
    } else {
      this.logger.warn(
        'RESEND_API_KEY veya RESEND_FROM_EMAIL yapılandırılmamış — e-posta gönderimi devre dışı',
      );
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async sendMagicLink(
    to: string,
    fullName: string,
    magicLink: string,
    associationName?: string,
  ): Promise<SendEmailResult> {
    const html = await renderMagicLinkTemplate({ fullName, magicLink, associationName });
    return this.send({
      to,
      subject: "Defter-i Hilal'e Davet — Hesabınızı Aktifleştirin",
      html,
      templateKey: 'magic-link',
    });
  }

  async sendWelcome(
    to: string,
    fullName: string,
    loginUrl: string,
    associationName?: string,
  ): Promise<SendEmailResult> {
    const html = await renderWelcomeTemplate({ fullName, loginUrl, associationName });
    return this.send({
      to,
      subject: "Defter-i Hilal'e Hoş Geldiniz",
      html,
      templateKey: 'welcome',
    });
  }

  async sendTempPassword(
    to: string,
    fullName: string,
    tempPassword: string,
  ): Promise<SendEmailResult> {
    return this.send({
      to,
      subject: 'Başvurunuz Onaylandı — Geçici Şifreniz',
      html: this.tempPasswordHtml(fullName, tempPassword),
      templateKey: 'temp-password',
    });
  }

  async sendBranchInvite(
    to: string,
    fullName: string,
    tempPassword: string,
    loginUrl: string,
  ): Promise<SendEmailResult> {
    return this.send({
      to,
      subject: "Defter-i Hilal'e Hoş Geldiniz",
      html: this.branchInviteHtml(to, fullName, tempPassword, loginUrl),
      templateKey: 'branch-invite',
    });
  }

  async sendInvitation(
    to: string,
    fullName: string,
    magicLink: string,
  ): Promise<SendEmailResult> {
    return this.send({
      to,
      subject: "Defter-i Hilal'e Davet — Hesabınızı Aktifleştirin",
      html: this.invitationHtml(fullName, magicLink),
      templateKey: 'invitation',
    });
  }

  async sendTelegramLinkEmail(
    to: string,
    fullName: string,
    botUsername: string,
    deepLinkUrl: string,
    tgDirectUrl: string,
    token: string,
    expiresAt: string,
    connectUrl?: string,
  ): Promise<SendEmailResult> {
    const html = await renderTelegramLinkTemplate({
      fullName,
      botUsername,
      deepLinkUrl,
      tgDirectUrl,
      token,
      expiresAt,
      connectUrl,
    });
    return this.send({
      to,
      subject: 'Telegram Hesabınızı Bağlayın',
      html,
      templateKey: 'telegram-link',
    });
  }

  // ─── Resend ────────────────────────────────────────────────────────────────

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    templateKey: string;
  }): Promise<SendEmailResult> {
    if (!this.client) {
      this.logger.warn(`Email gönderim atlandı (Resend yapılandırılmamış): ${params.to}`);
      return { messageId: null, previewUrl: null };
    }

    try {
      const response = await this.client.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await this.prisma.emailLog.create({
        data: {
          to: params.to,
          templateKey: params.templateKey,
          subject: params.subject,
          status: EmailStatus.SENT,
          resendId: response.data?.id ?? null,
          error: null,
        },
      });

      return { messageId: response.data?.id ?? null, previewUrl: null };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Resend gönderim hatası (${params.to}): ${message}`);

      await this.prisma.emailLog.create({
        data: {
          to: params.to,
          templateKey: params.templateKey,
          subject: params.subject,
          status: EmailStatus.FAILED,
          error: message,
        },
      });

      return { messageId: null, previewUrl: null };
    }
  }

  // ─── HTML Templates (fallback for non-React-Email templates) ───────────────

  private tempPasswordHtml(fullName: string, tempPassword: string): string {
    return this.wrapLayout(`
      <h1>Başvurunuz Onaylandı!</h1>
      <p>Merhaba <strong>${this.escape(fullName)}</strong>,</p>
      <p>
        Defter-i Hilal Organizasyon Yönetim Sistemi'ne üyelik başvurunuz onaylandı.
        Aşağıdaki geçici şifre ile giriş yapabilirsiniz.
      </p>
      <div style="margin:24px 0;padding:20px;background:#f5f5f0;border-radius:8px;text-align:center;border:1px solid #e0ddd5;">
        <p style="margin:0 0 8px;font-size:13px;color:#c59600;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Geçici Şifreniz</p>
        <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:0.12em;color:#0E0E0E;font-family:monospace;">${this.escape(tempPassword)}</p>
      </div>
      <p style="font-size:14px;color:#555555;">
        Giriş yaptıktan sonra <strong>Ayarlar → Hesabım</strong> bölümünden şifrenizi değiştirmenizi öneririz.
      </p>
      <p class="note">
        Bu e-postayı beklemiyordunuz lütfen sistem yöneticinizle iletişime geçin.
      </p>
    `);
  }

  private branchInviteHtml(email: string, fullName: string, tempPassword: string, loginUrl: string): string {
    return this.wrapLayout(`
      <h1>Defter-i Hilal'e Hoş Geldiniz!</h1>
      <p>Merhaba <strong>${this.escape(fullName)}</strong>,</p>
      <p>
        Defter-i Hilal Organizasyon Yönetim Sistemi'ne davet edildiniz.
        Aşağıdaki bilgilerle sisteme giriş yapabilir ve şubenizi yönetmeye başlayabilirsiniz.
      </p>
      <div style="margin:24px 0;padding:20px;background:#f5f5f0;border-radius:8px;border:1px solid #e0ddd5;">
        <p style="margin:0 0 6px;font-size:13px;color:#c59600;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">E-posta Adresiniz</p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1a1a1a;">${this.escape(email)}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#c59600;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Geçici Şifreniz</p>
        <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:0.12em;color:#0E0E0E;font-family:monospace;">${this.escape(tempPassword)}</p>
      </div>
      <p style="text-align:center;margin:28px 0;">
        <a href="${this.escape(loginUrl)}"
           style="display:inline-block;background:#FCC200;color:#0E0E0E;font-size:15px;font-weight:700;
                  text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.02em;">
          Sisteme Giriş Yap
        </a>
      </p>
      <p style="font-size:14px;color:#555555;">
        İlk girişin ardından <strong>Ayarlar → Hesabım</strong> bölümünden şifrenizi değiştirmenizi tavsiye ederiz.
      </p>
      <p class="note">
        Bu daveti beklemiyorsanız lütfen bu e-postayı dikkate almayın.
        Herhangi bir sorun için sistem yöneticinizle iletişime geçebilirsiniz.
      </p>
    `);
  }

  private invitationHtml(fullName: string, magicLink: string): string {
    return this.wrapLayout(`
      <h1>Defter-i Hilal'e Davet Edildiniz!</h1>
      <p>Merhaba <strong>${this.escape(fullName)}</strong>,</p>
      <p>
        Defter-i Hilal Organizasyon Yönetim Sistemi'ne davet edildiniz.
        Aşağıdaki butona tıklayarak hesabınızı aktifleştirebilir ve
        şubenizi yönetmeye başlayabilirsiniz.
      </p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${this.escape(magicLink)}"
           style="display:inline-block;background:#FCC200;color:#0E0E0E;font-size:16px;font-weight:700;
                  text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.02em;">
          Hesabımı Aktifleştir
        </a>
      </p>
      <p style="font-size:14px;color:#555555;margin-bottom:16px;">
        Buton çalışmazsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:
      </p>
      <p style="margin:0 0 24px;">
        <a href="${this.escape(magicLink)}"
           style="font-size:13px;color:#c59600;word-break:break-all;">
          ${this.escape(magicLink)}
        </a>
      </p>
      <p style="font-size:14px;color:#555555;">
        İlk girişin ardından profil bilgilerinizi tamamlamanızı öneririz.
      </p>
      <p class="note">
        Bu daveti beklemiyorsanız lütfen bu e-postayı dikkate almayın.
        Herhangi bir sorun için sistem yöneticinizle iletişime geçebilirsiniz.
      </p>
    `);
  }

  private wrapLayout(content: string): string {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Defter-i Hilal</title>
</head>
<body style="margin:0;padding:0;background-color:#f0efe8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f0efe8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;background:#ffffff;border-radius:12px;
                      box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;">

          <tr>
            <td style="background-color:#1a1a1a;padding:32px 40px 24px;text-align:center;">
              <p style="margin:0;color:#FCC200;font-size:26px;font-weight:800;letter-spacing:0.04em;">
                Defter-i Hilal
              </p>
              <p style="margin:6px 0 0;color:#cccccc;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">
                Organizasyon Yönetim Sistemi
              </p>
            </td>
          </tr>

          <tr>
            <td style="height:4px;background-color:#FCC200;"></td>
          </tr>

          <tr>
            <td style="padding:40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
              <style>
                h1 { font-size:22px; font-weight:700; color:#1a1a1a; margin:0 0 16px; }
                p  { margin:0 0 14px; }
                .note { font-size:13px; color:#555555; border-top:1px solid #e0ddd5;
                        padding-top:20px; margin-top:8px; }
              </style>
              ${content}
            </td>
          </tr>

          <tr>
            <td style="background-color:#f5f5f0;padding:24px 40px;
                       border-top:1px solid #e0ddd5;text-align:center;">
              <p style="margin:0;font-size:12px;color:#888888;">
                Bu e-posta Defter-i Hilal Organizasyon Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.<br>
                Lütfen bu e-postayı yanıtlamayın.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#c59600;font-weight:600;letter-spacing:0.06em;">
                defterihilal.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
