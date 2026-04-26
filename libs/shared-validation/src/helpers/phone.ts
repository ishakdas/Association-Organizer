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
