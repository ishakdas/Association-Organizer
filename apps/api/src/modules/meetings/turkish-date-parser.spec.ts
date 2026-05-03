import { parseTurkishDateText } from './turkish-date-parser';

const ref = new Date('2026-05-03T12:00:00Z');

describe('parseTurkishDateText', () => {
  describe('explicit day-month-year', () => {
    it('parses "15 Mayıs 2026"', () => {
      const d = parseTurkishDateText('15 Mayıs 2026', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-15');
    });

    it('parses "15 Mayıs 2026\'ya kadar"', () => {
      const d = parseTurkishDateText("15 Mayıs 2026'ya kadar", ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-15');
    });

    it('parses "28 Mayıs" (no year, uses ref year)', () => {
      const d = parseTurkishDateText('28 Mayıs', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-28');
    });

    it('parses "3 Haziran 2026"', () => {
      const d = parseTurkishDateText('3 Haziran 2026', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-06-03');
    });

    it('is case-insensitive', () => {
      const d = parseTurkishDateText('15 mayıs 2026', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-15');
    });
  });

  describe('month-only references', () => {
    it('parses "Haziran başında" → first day of June', () => {
      const d = parseTurkishDateText('Haziran başında', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-06-01');
    });

    it('parses "bu ay sonuna kadar" → last day of current month', () => {
      const d = parseTurkishDateText('bu ay sonuna kadar', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-31');
    });

    it('parses "ay sonu" → last day of current month', () => {
      const d = parseTurkishDateText('ay sonu', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-31');
    });
  });

  describe('relative durations', () => {
    it('parses "gelecek hafta" → ref + 7 days', () => {
      const d = parseTurkishDateText('gelecek hafta', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-10');
    });

    it('parses "2 hafta içinde"', () => {
      const d = parseTurkishDateText('2 hafta içinde', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-17');
    });

    it('parses "3 hafta içinde"', () => {
      const d = parseTurkishDateText('3 hafta içinde', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-05-24');
    });

    it('parses "1 ay içinde"', () => {
      const d = parseTurkishDateText('1 ay içinde', ref);
      expect(d?.toISOString().slice(0, 10)).toBe('2026-06-03');
    });
  });

  describe('unrecognized / null cases', () => {
    it('returns null for empty string', () => {
      expect(parseTurkishDateText('', ref)).toBeNull();
    });

    it('returns null for unrelated text', () => {
      expect(parseTurkishDateText('acil değil', ref)).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseTurkishDateText(null, ref)).toBeNull();
    });
  });
});
