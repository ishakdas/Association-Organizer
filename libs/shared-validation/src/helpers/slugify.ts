import slugifyLib from 'slugify';

/**
 * Turkish-aware slugify. Maps Turkish-specific characters to ASCII before
 * delegating to the `slugify` package, so 'Teşkilat Başkanı' → 'teskilat-baskani'.
 *
 * The package's built-in `locale: 'tr'` is correct for casing (`İ → i`),
 * but downstream consumers expect ASCII-only output for URL safety, so we
 * also strip the diacritics by mapping them upfront.
 */
const TR_TO_ASCII: Record<string, string> = {
  ç: 'c', Ç: 'c',
  ğ: 'g', Ğ: 'g',
  ı: 'i', I: 'i', İ: 'i',
  ö: 'o', Ö: 'o',
  ş: 's', Ş: 's',
  ü: 'u', Ü: 'u',
};

export function slugifyTr(input: string): string {
  const ascii = input
    .split('')
    .map((ch) => TR_TO_ASCII[ch] ?? ch)
    .join('');
  return slugifyLib(ascii, {
    lower: true,
    strict: true,
    trim: true,
  });
}
