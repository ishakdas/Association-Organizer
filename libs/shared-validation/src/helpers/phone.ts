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
 * Strip everything except digits, drop the "90" country prefix, and
 * drop the legacy leading "0" national prefix. Caps the output at 10
 * digits (the subscriber number: 5XXXXXXXXX).
 *
 * Used by the frontend mask. The visible PhoneInput renders a static
 * "+90" prefix outside the input; only the 10-digit subscriber number
 * lives inside the input and in form state.
 */
export function normalizeTrPhoneInput(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * Format a digits-only TR subscriber number as "555 111 22 33".
 * Accepts partial input and formats progressively (so it works while typing).
 * The input should already be normalised via normalizeTrPhoneInput.
 */
export function formatTrPhoneDisplay(digits: string): string {
  if (!digits) return '';
  const groups: string[] = [];
  groups.push(digits.slice(0, 3));
  if (digits.length > 3) groups.push(digits.slice(3, 6));
  if (digits.length > 6) groups.push(digits.slice(6, 8));
  if (digits.length > 8) groups.push(digits.slice(8, 10));
  return groups.filter(Boolean).join(' ');
}
