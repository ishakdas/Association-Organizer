/**
 * Turkish tax number (VKN) format check: exactly 10 digits.
 *
 * Sprint-1 scope is format-only. The official VKN mod-10 checksum is a
 * follow-up: drop it in here as a second pass and the schema picks it
 * up automatically.
 */
export const TAX_NUMBER_PATTERN = /^\d{10}$/;

export function isValidTaxNumber(raw: string): boolean {
  return TAX_NUMBER_PATTERN.test(raw);
}
