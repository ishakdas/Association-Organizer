const MONTHS: Record<string, number> = {
  ocak: 0, şubat: 1, mart: 2, nisan: 3, mayıs: 4, haziran: 5,
  temmuz: 6, ağustos: 7, eylül: 8, ekim: 9, kasım: 10, aralık: 11,
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 17, 0, 0));
}

export function parseTurkishDateText(text: string | null | undefined, ref: Date): Date | null {
  if (!text?.trim()) return null;

  const s = text.toLowerCase().trim();
  const refYear = ref.getUTCFullYear();
  const refMonth = ref.getUTCMonth();

  // "15 mayıs 2026" / "15 mayıs 2026'ya kadar" / "28 mayıs"
  const dayMonthYear = s.match(/(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s+(\d{4}))?/);
  if (dayMonthYear) {
    const day = parseInt(dayMonthYear[1], 10);
    const month = MONTHS[dayMonthYear[2]];
    const year = dayMonthYear[3] ? parseInt(dayMonthYear[3], 10) : refYear;
    return utcDate(year, month, day);
  }

  // "haziran başında" / "mayıs başı"
  const monthStart = s.match(/(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+başı?n?d?a?/);
  if (monthStart) {
    const month = MONTHS[monthStart[1]];
    const year = month < refMonth ? refYear + 1 : refYear;
    return utcDate(year, month, 1);
  }

  // "bu ay sonu" / "ay sonu" / "bu ay sonuna kadar"
  if (s.includes('ay son')) {
    return utcDate(refYear, refMonth + 1, 0);
  }

  // "2 hafta içinde" / "3 hafta sonra"
  const weeksMatch = s.match(/(\d+)\s*hafta/);
  if (weeksMatch) {
    return addDays(ref, parseInt(weeksMatch[1], 10) * 7);
  }

  // "gelecek hafta"
  if (s.includes('gelecek hafta') || s.includes('önümüzdeki hafta')) {
    return addDays(ref, 7);
  }

  // "1 ay içinde" / "2 ay sonra"
  const monthsMatch = s.match(/(\d+)\s*ay/);
  if (monthsMatch) {
    return addMonths(ref, parseInt(monthsMatch[1], 10));
  }

  return null;
}
