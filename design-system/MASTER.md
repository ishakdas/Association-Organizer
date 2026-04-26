# Design System — Dernek Yönetim Sistemi

**Product**: Turkish non-profit (dernek) management SaaS — admin/back-office.
**Users**: Dernek sekreterleri (30–60 yaş, low-to-medium tech literacy).
**Tone**: Trustworthy, official-but-approachable, calm.
**Source**: ui-ux-pro-max skill query (`--design-system`), 2026-04-24.

## Style Archetype
**Data-Dense Dashboard** — CRUD list/detail/form pages on shadcn/ui `new-york` style.

- Multiple tables/cards/KPIs, minimal padding, grid layout, maximum data visibility.
- Full light + dark support.
- Performance excellent, WCAG AA.

**Avoid**: ornate decoration, missing filtering, emoji-as-icon, pure black text on pure white background.

## Palette — Slate + Sky (OKLCH)

Replaces the prior `neutral` grayscale palette. Primary navy + sky accent convey **institutional trust** without sterility.

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--background` | `oklch(0.984 0.003 247.858)` slate-50 | `oklch(0.129 0.042 264.695)` slate-950 | Page surface |
| `--foreground` | `oklch(0.208 0.042 265.755)` slate-900 | `oklch(0.984 0.003 247.858)` slate-50 | Primary text |
| `--card` | `oklch(1 0 0)` | `oklch(0.208 0.042 265.755)` slate-900 | Card surface |
| `--primary` | `oklch(0.208 0.042 265.755)` slate-900 | `oklch(0.929 0.013 255.508)` slate-200 | Primary button/CTA |
| `--secondary` | `oklch(0.968 0.007 247.896)` slate-100 | `oklch(0.279 0.041 260.031)` slate-800 | Secondary button |
| `--muted` | `oklch(0.968 0.007 247.896)` slate-100 | `oklch(0.279 0.041 260.031)` slate-800 | Muted bg |
| `--muted-foreground` | `oklch(0.554 0.046 257.417)` slate-500 | `oklch(0.704 0.04 256.788)` slate-400 | Muted text |
| `--accent` | `oklch(0.968 0.007 247.896)` slate-100 | `oklch(0.279 0.041 260.031)` slate-800 | Hover/selected bg |
| `--border` | `oklch(0.929 0.013 255.508)` slate-200 | `oklch(1 0 0 / 10%)` | Divider |
| `--ring` | `oklch(0.588 0.158 241.966)` sky-600 | `oklch(0.685 0.169 237.323)` sky-500 | Focus ring (**blue**) |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Delete/danger |

**Accent rule**: interactive focus/selection uses **sky-600** (not slate) to draw the eye toward actionable state without shouting.

## Typography
**Plus Jakarta Sans** for both heading and body (single-family simplicity).
- Weights: 400 / 500 / 600 / 700 / 800
- Loaded via `next/font/google` in `apps/web/src/app/layout.tsx` → binds to `--font-sans` CSS var.
- Tailwind v4 picks up `--font-sans` automatically.
- Explicitly recommended for: B2B SaaS, admin dashboards, government/finance, enterprise.
- Turkish glyphs supported (Latin Extended-A).

## Layout Guardrails
1. **Container**: page content max-width `max-w-6xl` (desktop), `px-4` mobile / `px-6` desktop horizontal insets.
2. **Spacing rhythm**: 4/8pt scale. Section spacing tiers: `gap-4` (within group), `gap-6` (between groups), `gap-10` (between sections).
3. **Density**: admin CRUD list = `py-2` row padding (compact). Detail/form = `py-3` (comfortable).
4. **Focus ring**: always visible, 2px, `ring-ring` token (sky-600).

## Typography Scale (tailwind)
| Role | Class | px |
|------|-------|-----|
| H1 page title | `text-3xl font-semibold tracking-tight` | 30 |
| H2 section | `text-xl font-semibold` | 20 |
| H3 card title | `text-base font-semibold` | 16 |
| Body | `text-sm` | 14 |
| Label | `text-sm font-medium` | 14 |
| Caption | `text-xs text-muted-foreground` | 12 |

Body is 14 (not 16) — dense admin tool convention. Mobile form inputs should still be ≥16px to avoid iOS auto-zoom (handled by shadcn defaults).

## Interaction States
- Hover row: `hover:bg-accent` (slate-100 light / slate-800 dark)
- Active/selected: `bg-accent text-accent-foreground` + `ring-1 ring-ring`
- Disabled: `opacity-50 pointer-events-none`
- Animation: 150–200ms `transition-colors`

## Icons
`lucide-react` only. No emoji. Default stroke 1.5px, size 16 (inline) or 20 (standalone).

## Pages Override Pattern
Page-specific deviations go under `design-system/pages/<page>.md` and override this MASTER.
