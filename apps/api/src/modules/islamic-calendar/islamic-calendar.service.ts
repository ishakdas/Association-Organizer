import { Injectable } from '@nestjs/common';

// moment-hijri is a CommonJS module that patches moment
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moment = require('moment-hijri');

export interface IslamicHoliday {
  name: string;
  nameEn: string;
  hijriDate: string; // "1446-09-27"
  gregorianDate: string; // "2025-03-27"
  daysUntil: number;
  category: 'kandil' | 'bayram' | 'omer';
}

export interface IslamicCalendarInfo {
  currentHijriDate: string;
  currentHijriMonthName: string;
  currentHijriYear: number;
  upcomingHolidays: IslamicHoliday[];
}

interface HolidayRule {
  name: string;
  nameEn: string;
  hijriMonth: number; // 1-based
  hijriDay: number;
  category: 'kandil' | 'bayram' | 'omer';
}

const HOLIDAY_RULES: HolidayRule[] = [
  { name: 'Regaib Gecesi', nameEn: 'Regaib Night', hijriMonth: 7, hijriDay: 1, category: 'kandil' },
  { name: "Miraç Gecesi", nameEn: "Miraj Night", hijriMonth: 7, hijriDay: 27, category: 'kandil' },
  { name: "Berat Gecesi", nameEn: "Beraat Night", hijriMonth: 8, hijriDay: 15, category: 'kandil' },
  { name: "Ramazan Başlangıcı", nameEn: "Start of Ramadan", hijriMonth: 9, hijriDay: 1, category: 'omer' },
  { name: "Kadir Gecesi", nameEn: "Night of Power", hijriMonth: 9, hijriDay: 27, category: 'kandil' },
  { name: "Ramazan Bayramı (1. Gün)", nameEn: "Eid al-Fitr Day 1", hijriMonth: 10, hijriDay: 1, category: 'bayram' },
  { name: "Arefe Günü (Kurban)", nameEn: "Arafah Day", hijriMonth: 12, hijriDay: 9, category: 'omer' },
  { name: "Kurban Bayramı (1. Gün)", nameEn: "Eid al-Adha Day 1", hijriMonth: 12, hijriDay: 10, category: 'bayram' },
];

const MONTH_NAMES = [
  'Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir',
  'Cemaziyelevvel', 'Cemaziyelahir', 'Recep', 'Şaban',
  'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce',
];

@Injectable()
export class IslamicCalendarService {
  /**
   * Returns today's date in Hijri calendar.
   */
  getTodayHijri(): { year: number; month: number; day: number; monthName: string } {
    const m = moment();
    return {
      year: m.iYear(),
      month: m.iMonth() + 1,
      day: m.iDate(),
      monthName: MONTH_NAMES[m.iMonth()] ?? 'Bilinmeyen',
    };
  }

  /**
   * Convert a Hijri date to Gregorian date string (YYYY-MM-DD).
   */
  hijriToGregorian(year: number, month: number, day: number): string {
    const m = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`, 'iYYYY-iMM-iDD');
    return m.format('YYYY-MM-DD');
  }

  /**
   * Get upcoming Islamic holidays from today (next 365 days).
   */
  getUpcomingHolidays(daysAhead = 365): IslamicHoliday[] {
    const today = moment().startOf('day');
    const cutoff = moment().add(daysAhead, 'days').startOf('day');
    const currentHijriYear = today.iYear();

    const holidays: IslamicHoliday[] = [];

    // Check current and next Hijri year
    for (const year of [currentHijriYear, currentHijriYear + 1]) {
      for (const rule of HOLIDAY_RULES) {
        try {
          const gregorianStr = this.hijriToGregorian(year, rule.hijriMonth, rule.hijriDay);
          const gregorianMoment = moment(gregorianStr, 'YYYY-MM-DD').startOf('day');

          if (gregorianMoment.isSameOrAfter(today) && gregorianMoment.isSameOrBefore(cutoff)) {
            const daysUntil = gregorianMoment.diff(today, 'days');
            holidays.push({
              name: rule.name,
              nameEn: rule.nameEn,
              hijriDate: `${year}-${rule.hijriMonth.toString().padStart(2, '0')}-${rule.hijriDay.toString().padStart(2, '0')}`,
              gregorianDate: gregorianStr,
              daysUntil,
              category: rule.category,
            });
          }
        } catch {
          // Skip invalid dates
        }
      }
    }

    // Sort by days until
    return holidays.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  /**
   * Get formatted upcoming holidays for AI prompt inclusion.
   */
  getHolidaysForPrompt(maxCount = 5): { name: string; date: string; daysUntil: number }[] {
    return this.getUpcomingHolidays(180).slice(0, maxCount).map((h) => ({
      name: h.name,
      date: h.gregorianDate,
      daysUntil: h.daysUntil,
    }));
  }

  /**
   * Full calendar info for a given date (defaults to today).
   */
  getCalendarInfo(): IslamicCalendarInfo {
    const hijri = this.getTodayHijri();
    const holidays = this.getUpcomingHolidays();

    return {
      currentHijriDate: `${hijri.day} ${hijri.monthName} ${hijri.year}`,
      currentHijriMonthName: hijri.monthName,
      currentHijriYear: hijri.year,
      upcomingHolidays: holidays,
    };
  }
}
