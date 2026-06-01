'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

const VALID_SECTIONS = [
  'dashboard',
  'finans',
  'uyeler',
  'gorevler',
  'toplantilar',
  'telegram',
  'yetkiler',
  'ayarlar',
] as const;

type SectionKey = (typeof VALID_SECTIONS)[number];

type SectionRouterProps = Record<SectionKey, ReactNode>;

/**
 * Renders the section matching the `?section` query param. All sections are
 * passed in as already-rendered slots (mirrors the admin `DetailTabs` pattern),
 * so only the active one mounts and fetches. Reads the section from
 * `useSearchParams`, which updates on `window.history.pushState` — letting the
 * sidebar switch sections instantly with no server round-trip.
 */
export function SectionRouter(sections: SectionRouterProps) {
  const searchParams = useSearchParams();
  const raw = searchParams.get('section');
  const active: SectionKey = VALID_SECTIONS.includes(raw as SectionKey)
    ? (raw as SectionKey)
    : 'dashboard';

  return <>{sections[active]}</>;
}
