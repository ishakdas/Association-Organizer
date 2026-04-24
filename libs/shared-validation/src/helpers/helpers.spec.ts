import { parsePhoneE164 } from './phone';
import { isValidTaxNumber, TAX_NUMBER_PATTERN } from './tax-number';
import { slugifyTr } from './slugify';

describe('parsePhoneE164', () => {
  it('normalizes Turkish local format', () => {
    expect(parsePhoneE164('0555 111 22 33')).toBe('+905551112233');
  });

  it('normalizes unspaced local format', () => {
    expect(parsePhoneE164('05551112233')).toBe('+905551112233');
  });

  it('normalizes +90 with spaces', () => {
    expect(parsePhoneE164('+90 555 111 22 33')).toBe('+905551112233');
  });

  it('returns null on clearly invalid input', () => {
    expect(parsePhoneE164('12')).toBeNull();
  });

  it('returns null on non-numeric garbage', () => {
    expect(parsePhoneE164('hello')).toBeNull();
  });

  it('returns null on empty string', () => {
    expect(parsePhoneE164('')).toBeNull();
  });
});

describe('isValidTaxNumber', () => {
  it('accepts exactly 10 digits', () => {
    expect(isValidTaxNumber('1234567890')).toBe(true);
  });

  it('rejects 9 digits', () => {
    expect(isValidTaxNumber('123456789')).toBe(false);
  });

  it('rejects 11 digits', () => {
    expect(isValidTaxNumber('12345678901')).toBe(false);
  });

  it('rejects letters', () => {
    expect(isValidTaxNumber('12345abcde')).toBe(false);
  });

  it('rejects whitespace', () => {
    expect(isValidTaxNumber('123 456 789')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidTaxNumber('')).toBe(false);
  });

  it('TAX_NUMBER_PATTERN matches the same set', () => {
    expect(TAX_NUMBER_PATTERN.test('1234567890')).toBe(true);
    expect(TAX_NUMBER_PATTERN.test('123')).toBe(false);
  });
});

describe('slugifyTr', () => {
  it('lowercases, replaces Turkish chars and joins with hyphens', () => {
    expect(slugifyTr('Teşkilat Başkanı')).toBe('teskilat-baskani');
  });

  it('handles dotted I and dotless ı correctly', () => {
    expect(slugifyTr('İstanbul')).toBe('istanbul');
    expect(slugifyTr('Mali İşler Sorumlusu')).toBe('mali-isler-sorumlusu');
  });

  it('strips punctuation and collapses runs of separators', () => {
    expect(slugifyTr("Kültür-Sanat Sorumlusu")).toBe('kultur-sanat-sorumlusu');
  });

  it('trims leading/trailing separators', () => {
    expect(slugifyTr('  Gençlik Kolu  ')).toBe('genclik-kolu');
  });

  it('returns empty string for input that contains no slug-able characters', () => {
    expect(slugifyTr('   ')).toBe('');
  });
});
