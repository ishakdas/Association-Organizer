import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';

zxcvbnOptions.setOptions({
  dictionary: { ...zxcvbnCommonPackage.dictionary },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
});

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomFromSet(set: string, n: number): string {
  const out = new Array<string>(n);
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) {
    out[i] = set[buf[i] % set.length];
  }
  return out.join('');
}

export function generatePassword(length = 16): string {
  if (length < 8) length = 8;
  // Guarantee at least one of each class — the rest random across all sets.
  const required = [
    randomFromSet(LOWER, 1),
    randomFromSet(UPPER, 1),
    randomFromSet(DIGITS, 1),
    randomFromSet(SYMBOLS, 1),
  ];
  const rest = randomFromSet(ALL, length - required.length);
  const merged = (required.join('') + rest).split('');
  // Fisher–Yates shuffle so required chars don't all sit at the front.
  const buf = new Uint32Array(merged.length);
  crypto.getRandomValues(buf);
  for (let i = merged.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }
  return merged.join('');
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: 'destructive' | 'warning' | 'success';
}

const LABELS: Record<0 | 1 | 2 | 3 | 4, PasswordStrength> = {
  0: { score: 0, label: 'Çok zayıf', tone: 'destructive' },
  1: { score: 1, label: 'Zayıf', tone: 'destructive' },
  2: { score: 2, label: 'Orta', tone: 'warning' },
  3: { score: 3, label: 'Güçlü', tone: 'success' },
  4: { score: 4, label: 'Çok güçlü', tone: 'success' },
};

export function evaluatePasswordStrength(value: string): PasswordStrength {
  if (!value) return LABELS[0];
  const result = zxcvbn(value);
  return LABELS[result.score as 0 | 1 | 2 | 3 | 4];
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
