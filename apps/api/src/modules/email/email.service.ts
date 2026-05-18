import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, EmailStatus } from '@ticketbot/database';
import { BrevoClient } from '@getbrevo/brevo';
import {
  renderMagicLinkTemplate,
  renderWelcomeTemplate,
  renderTelegramLinkTemplate,
} from './templates/index';

interface BrevoEmailRequest {
  sender: { email: string; name?: string };
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent?: string;
  textContent?: string;
}

export interface SendEmailResult {
  messageId: string | null;
  previewUrl: string | null;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private client: BrevoClient | null = null;
  private fromEmail = '';
  private fromName = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const apiKey = this.config.get<string>('brevo.apiKey');
    const fromEmail = this.config.get<string>('brevo.fromEmail');
    const fromName = this.config.get<string>('brevo.fromName') ?? 'Dernek Yönetim Sistemi';

    if (apiKey && fromEmail) {
      this.client = new BrevoClient({ apiKey });
      this.fromEmail = fromEmail;
      this.fromName = fromName;
      this.logger.log(`Brevo aktif — gönderen: ${fromName} <${fromEmail}>`);
    } else {
      this.logger.warn(
        'BREVO_API_KEY veya BREVO_FROM_EMAIL yapılandırılmamış — e-posta gönderimi devre dışı',
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
      subject: "Yedimuîn'e Davet — Hesabınızı Aktifleştirin",
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
      subject: "Yedimuîn'e Hoş Geldiniz",
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
      subject: "Yedimuîn'e Hoşgeldiniz",
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
      subject: "Yedimuîn'e Davet — Hesabınızı Aktifleştirin",
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

  // ─── Brevo ─────────────────────────────────────────────────────────────────

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    templateKey: string;
  }): Promise<SendEmailResult> {
    if (!this.client) {
      this.logger.warn(`Email gönderim atlandı (Brevo yapılandırılmamış): ${params.to}`);
      return { messageId: null, previewUrl: null };
    }

    try {
      const request: BrevoEmailRequest = {
        sender: { email: this.fromEmail, name: this.fromName },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
      };

      const response = await this.client.transactionalEmails.sendTransacEmail(request);

      await this.prisma.emailLog.create({
        data: {
          to: params.to,
          templateKey: params.templateKey,
          subject: params.subject,
          status: EmailStatus.SENT,
          resendId: response.messageId ?? null,
          error: null,
        },
      });

      return { messageId: response.messageId ?? null, previewUrl: null };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Brevo gönderim hatası (${params.to}): ${message}`);

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
        Dernek yönetim sistemine üyelik başvurunuz onaylandı.
        Aşağıdaki geçici şifre ile giriş yapabilirsiniz.
      </p>
      <div style="margin:24px 0;padding:20px;background:#f3f4f6;border-radius:8px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Geçici Şifreniz</p>
        <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:0.12em;color:#111827;font-family:monospace;">${this.escape(tempPassword)}</p>
      </div>
      <p style="font-size:14px;color:#374151;">
        Giriş yaptıktan sonra <strong>Ayarlar → Hesabım</strong> bölümünden şifrenizi değiştirmenizi öneririz.
      </p>
      <p class="note">
        Bu e-postayı beklemiyordaydınız lütfen sistem yöneticinizle iletişime geçin.
      </p>
    `);
  }

  private branchInviteHtml(email: string, fullName: string, tempPassword: string, loginUrl: string): string {
    return this.wrapLayout(`
      <h1>Yedimuîn'e Hoşgeldiniz!</h1>
      <p>Merhaba <strong>${this.escape(fullName)}</strong>,</p>
      <p>
        Yedimuîn Dernek Yönetim Sistemi'ne davet edildiniz.
        Aşağıdaki bilgilerle sisteme giriş yapabilir ve şubenizi yönetmeye başlayabilirsiniz.
      </p>
      <div style="margin:24px 0;padding:20px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
        <p style="margin:0 0 6px;font-size:13px;color:#0369a1;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">E-posta Adresiniz</p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#0c4a6e;">${this.escape(email)}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#0369a1;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Geçici Şifreniz</p>
        <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:0.12em;color:#0c4a6e;font-family:monospace;">${this.escape(tempPassword)}</p>
      </div>
      <p style="text-align:center;margin:28px 0;">
        <a href="${this.escape(loginUrl)}"
           style="display:inline-block;background:#1e40af;color:#ffffff;font-size:15px;font-weight:600;
                  text-decoration:none;padding:12px 32px;border-radius:8px;letter-spacing:0.02em;">
          Sisteme Giriş Yap
        </a>
      </p>
      <p style="font-size:14px;color:#374151;">
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
      <h1>Yedimuîn'e Davet Edildiniz!</h1>
      <p>Merhaba <strong>${this.escape(fullName)}</strong>,</p>
      <p>
        Yedimuîn Dernek Yönetim Sistemi'ne davet edildiniz.
        Aşağıdaki butona tıklayarak hesabınızı aktifleştirebilir ve
        şubenizi yönetmeye başlayabilirsiniz.
      </p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${this.escape(magicLink)}"
           style="display:inline-block;background:#1e40af;color:#ffffff;font-size:16px;font-weight:600;
                  text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.02em;">
          Hesabımı Aktifleştir
        </a>
      </p>
      <p style="font-size:14px;color:#6b7280;margin-bottom:16px;">
        Buton çalışmazsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:
      </p>
      <p style="margin:0 0 24px;">
        <a href="${this.escape(magicLink)}"
           style="font-size:13px;color:#2563eb;word-break:break-all;">
          ${this.escape(magicLink)}
        </a>
      </p>
      <p style="font-size:14px;color:#374151;">
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
  <title>Dernek Yönetim Sistemi</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;background:#ffffff;border-radius:12px;
                      box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">

          <tr>
            <td style="background-color:#1e40af;padding:28px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">
                Dernek Yönetim Sistemi
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:40px;color:#111827;font-size:15px;line-height:1.6;">
              <style>
                h1 { font-size:22px; font-weight:700; color:#111827; margin:0 0 16px; }
                p  { margin:0 0 14px; }
                .note { font-size:13px; color:#6b7280; border-top:1px solid #e5e7eb;
                        padding-top:20px; margin-top:8px; }
              </style>
              ${content}
            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;
                       border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Bu e-posta Dernek Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.<br>
                Lütfen bu e-postayı yanıtlamayın.
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
