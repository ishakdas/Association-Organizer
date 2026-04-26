import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Parse a user-typed phone number using Turkey as the default country.
 * Returns the E.164 representation ("+90XXXXXXXXXX") on success, null otherwise.
 *
 * Accepts common formats: "0555 111 22 33", "05551112233", "+90 555 111 22 33".
 */
export function parsePhoneE164(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw, 'TR');
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/**
 * Strip everything except digits, drop a leading "90" country code, and
 * make sure the result starts with "0" (Turkish national prefix). Caps the
 * output at 11 digits ("0" + 10-digit subscriber number).
 *
 * Used by the frontend mask: as the user types, we keep only the digits
 * and let the formatter add the visual spacing.
 */
export function normalizeTrPhoneInput(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.slice(2);
  if (digits.length === 0) return '';
  if (!digits.startsWith('0')) digits = `0${digits}`;
  return digits.slice(0, 11);
}

/**
 * Format a digits-only TR phone number as "0 555 111 22 33".
 * Accepts partial input and formats progressively (so it works while typing).
 * The input should already be normalised via normalizeTrPhoneInput.
 */
export function formatTrPhoneDisplay(digits: string): string {
  if (!digits) return '';
  const groups: string[] = [];
  groups.push(digits.slice(0, 1));
  if (digits.length > 1) groups.push(digits.slice(1, 4));
  if (digits.length > 4) groups.push(digits.slice(4, 7));
  if (digits.length > 7) groups.push(digits.slice(7, 9));
  if (digits.length > 9) groups.push(digits.slice(9, 11));
  return groups.filter(Boolean).join(' ');
}
