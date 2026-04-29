import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { PrismaService } from '@ticketbot/database';

interface RenderableEvent {
  id: string;
  associationId: string;
  title: string;
  description: string | null;
  type: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  notifyAt: string;
  recurrenceType: string;
  recurrenceInterval: number;
  assignments: Array<{
    id: string;
    member: { id: string; fullName: string; phone: string | null };
    roleDefinition: { id: string; name: string } | null;
    customRole: string | null;
    notes: string | null;
  }>;
}

const TR_DATE = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

const TR_DATE_SHORT = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Istanbul',
});

const EVENT_TYPE_LABELS: Record<string, string> = {
  CONFERENCE: 'Konferans',
  TALK: 'Sohbet',
  SEMINAR: 'Seminer',
  IFTAR: 'İftar Programı',
  KANDIL: 'Kandil Programı',
  MEETING: 'Toplantı',
  CUSTOM: 'Etkinlik',
};

const RECURRENCE_LABELS: Record<string, string> = {
  NONE: 'Tek seferlik',
  DAILY: 'Her gün',
  WEEKLY: 'Haftalık',
  MONTHLY: 'Aylık',
};

@Injectable()
export class EventPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(EventPdfService.name);
  private browser: Browser | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  async renderResponsibilityList(event: RenderableEvent): Promise<Buffer> {
    const association = await this.prisma.association.findUnique({
      where: { id: event.associationId },
      select: {
        name: true,
        shortName: true,
        logoUrl: true,
        city: true,
        district: true,
      },
    });

    const html = this.buildHtml(event, association);
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.logger.log('Launching headless Chromium for PDF rendering');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return this.browser;
  }

  private buildHtml(
    event: RenderableEvent,
    association: {
      name: string;
      shortName: string | null;
      logoUrl: string | null;
      city: string;
      district: string;
    } | null,
  ): string {
    const startsAt = new Date(event.startsAt);
    const endsAt = event.endsAt ? new Date(event.endsAt) : null;
    const notifyAt = new Date(event.notifyAt);

    const dernek = association
      ? association.shortName ?? association.name
      : 'Dernek';
    const dernekFull = association?.name ?? '';
    const lokasyon = [association?.district, association?.city]
      .filter(Boolean)
      .join(' / ');

    const rows = event.assignments
      .slice()
      .sort((a, b) => {
        const ar = a.roleDefinition?.name ?? a.customRole ?? '';
        const br = b.roleDefinition?.name ?? b.customRole ?? '';
        return ar.localeCompare(br, 'tr');
      })
      .map((a, idx) => {
        const role = a.roleDefinition?.name ?? a.customRole ?? '—';
        const phone = a.member.phone ?? '—';
        const notes = a.notes ?? '';
        return `
          <tr>
            <td class="num">${idx + 1}</td>
            <td class="role">${escapeHtml(role)}</td>
            <td>${escapeHtml(a.member.fullName)}</td>
            <td class="mono">${escapeHtml(phone)}</td>
            <td class="notes">${escapeHtml(notes)}</td>
          </tr>`;
      })
      .join('');

    return /* html */ `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>Etkinlik Sorumluluk Listesi</title>
    <style>
      @page { size: A4; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
          'Helvetica Neue', Arial, sans-serif;
        color: #1a1a1a;
        margin: 0;
        padding: 0;
        line-height: 1.5;
        font-size: 11pt;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 20px;
        border-bottom: 3px solid #0f172a;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .logo {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        background: #0f172a;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 24pt;
        flex-shrink: 0;
        overflow: hidden;
      }
      .logo img { width: 100%; height: 100%; object-fit: cover; }
      .header-text h1 {
        margin: 0;
        font-size: 18pt;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .header-text .sub {
        margin-top: 2px;
        color: #475569;
        font-size: 10pt;
      }
      .badge {
        display: inline-block;
        padding: 3px 10px;
        background: #f1f5f9;
        color: #475569;
        border-radius: 999px;
        font-size: 9pt;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-left: 8px;
        vertical-align: middle;
      }
      .event-title {
        font-size: 22pt;
        font-weight: 700;
        line-height: 1.2;
        margin: 0 0 12px;
        letter-spacing: -0.02em;
      }
      .event-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 24px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 24px;
      }
      .meta-row {
        display: flex;
        gap: 8px;
        font-size: 10.5pt;
      }
      .meta-row .label {
        color: #64748b;
        font-weight: 500;
        min-width: 88px;
      }
      .meta-row .value {
        color: #0f172a;
        font-weight: 500;
      }
      h2 {
        font-size: 13pt;
        font-weight: 700;
        margin: 0 0 12px;
        color: #0f172a;
        display: flex;
        align-items: center;
      }
      h2::before {
        content: '';
        display: inline-block;
        width: 4px;
        height: 16px;
        background: #0ea5e9;
        margin-right: 10px;
        border-radius: 2px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10.5pt;
      }
      thead th {
        text-align: left;
        padding: 10px 12px;
        background: #0f172a;
        color: #fff;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
      }
      thead th:first-child { border-top-left-radius: 8px; }
      thead th:last-child { border-top-right-radius: 8px; }
      tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      tbody tr:last-child td { border-bottom: none; }
      td.num { color: #94a3b8; width: 32px; font-variant-numeric: tabular-nums; }
      td.role { font-weight: 600; color: #0f172a; }
      td.mono { font-variant-numeric: tabular-nums; color: #475569; }
      td.notes { color: #64748b; font-size: 10pt; }
      .empty {
        padding: 32px;
        text-align: center;
        color: #94a3b8;
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 12px;
      }
      .footer {
        margin-top: 32px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
        font-size: 9pt;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
      }
      .desc {
        background: #fffbeb;
        border-left: 3px solid #f59e0b;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 10.5pt;
        color: #78350f;
        margin-bottom: 24px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="logo">${
        association?.logoUrl
          ? `<img src="${escapeAttr(association.logoUrl)}" alt="logo" />`
          : escapeHtml(initials(dernek))
      }</div>
      <div class="header-text">
        <h1>${escapeHtml(dernek)}</h1>
        <div class="sub">${escapeHtml(dernekFull)} ${
      lokasyon ? `· ${escapeHtml(lokasyon)}` : ''
    }</div>
      </div>
    </div>

    <h2>Etkinlik Sorumluluk Listesi</h2>

    <div class="event-title">
      ${escapeHtml(event.title)}
      <span class="badge">${escapeHtml(
        EVENT_TYPE_LABELS[event.type] ?? event.type,
      )}</span>
    </div>

    <div class="event-meta">
      <div class="meta-row">
        <span class="label">Tarih</span>
        <span class="value">${escapeHtml(TR_DATE.format(startsAt))}</span>
      </div>
      ${
        endsAt
          ? `<div class="meta-row"><span class="label">Bitiş</span><span class="value">${escapeHtml(
              TR_DATE.format(endsAt),
            )}</span></div>`
          : ''
      }
      <div class="meta-row">
        <span class="label">Yer</span>
        <span class="value">${escapeHtml(event.location ?? '—')}</span>
      </div>
      <div class="meta-row">
        <span class="label">Bildirim</span>
        <span class="value">${escapeHtml(TR_DATE.format(notifyAt))}</span>
      </div>
      <div class="meta-row">
        <span class="label">Tekrar</span>
        <span class="value">${escapeHtml(
          RECURRENCE_LABELS[event.recurrenceType] ?? event.recurrenceType,
        )}</span>
      </div>
    </div>

    ${
      event.description
        ? `<div class="desc">${escapeHtml(event.description)}</div>`
        : ''
    }

    <h2>Görev Dağılımı</h2>
    ${
      event.assignments.length === 0
        ? `<div class="empty">Henüz sorumluluk atanmadı.</div>`
        : `<table>
            <thead>
              <tr>
                <th>#</th>
                <th>Rol</th>
                <th>Sorumlu</th>
                <th>Telefon</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
    }

    <div class="footer">
      <span>Oluşturulma: ${escapeHtml(TR_DATE_SHORT.format(new Date()))}</span>
      <span>${escapeHtml(dernek)} · Etkinlik ID: ${escapeHtml(event.id)}</span>
    </div>
  </body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toLocaleUpperCase('tr-TR') ?? '')
    .join('');
}
