import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('smtp.host');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('smtp.port') ?? 587,
        secure: (this.config.get<number>('smtp.port') ?? 587) === 465,
        auth: {
          user: this.config.get<string>('smtp.user'),
          pass: this.config.get<string>('smtp.pass'),
        },
      });
      const fromName = this.config.get<string>('smtp.fromName') ?? 'Dernek Yönetim Sistemi';
      const fromAddr = this.config.get<string>('smtp.from') ?? host;
      this.from = `"${fromName}" <${fromAddr}>`;
      this.logger.log(`E-posta servisi aktif: ${host}`);
    } else {
      const test = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: test.user, pass: test.pass },
      });
      this.from = `"Dernek Yönetim Sistemi" <${test.user}>`;
      this.logger.warn('SMTP yapılandırılmamış — geliştirme için Ethereal kullanılıyor');
    }
  }

  async sendTempPassword(
    to: string,
    fullName: string,
    tempPassword: string,
  ): Promise<{ previewUrl: string | null }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Başvurunuz Onaylandı — Geçici Şifreniz',
      html: this.tempPasswordHtml(fullName, tempPassword),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    if (previewUrl) {
      this.logger.log(`[DEV] E-posta önizlemesi: ${previewUrl}`);
    }
    return { previewUrl };
  }

  async sendBranchInvite(
    to: string,
    fullName: string,
    tempPassword: string,
    loginUrl: string,
  ): Promise<{ previewUrl: string | null }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject: "Yedimuîn'e Hoşgeldiniz",
      html: this.branchInviteHtml(to, fullName, tempPassword, loginUrl),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    if (previewUrl) {
      this.logger.log(`[DEV] E-posta önizlemesi: ${previewUrl}`);
    }
    return { previewUrl };
  }

  // ─── HTML Templates ──────────────────────────────────────────────────────────

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

          <!-- Header -->
          <tr>
            <td style="background-color:#1e40af;padding:28px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">
                🏛 Dernek Yönetim Sistemi
              </p>
            </td>
          </tr>

          <!-- Body -->
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

          <!-- Footer -->
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
