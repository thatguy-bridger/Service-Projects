# Design Language

Reference: `docs/design-language.md`
Tokens (source of truth for code): `packages/ui/src/tokens.css`, `packages/ui/src/tokens.ts`
Base components: `packages/ui/src/components.css`, `packages/ui/src/{Button,Card,Badge}.tsx`

This document defines how every app in `apps/*` should look and feel. All
apps import the same tokens and base components from `@service-projects/ui`
— do not redefine colors, spacing, or radius locally. If a value you need
isn't here, add it to the tokens file first, then use it.

## Personality

**Friendly & approachable.** Warm neutral grays (not cold blue-grays),
generous rounding, soft shadows, one confident accent color. This is a
service app used by both administrators and end users day-to-day — it
should feel welcoming and low-friction, not clinical or enterprise-dense.

## Color

| Role | Token | Light | Dark |
|---|---|---|---|
| Accent (primary) | `--color-accent-500` | `#6f4ef0` | `#6f4ef0` |
| Page background | `--surface-page` | `--color-gray-50` | `--color-gray-900` |
| Raised surface (cards, modals) | `--surface-raised` | `--color-gray-0` | `--color-gray-800` |
| Sunken surface (inputs, wells) | `--surface-sunken` | `--color-gray-100` | `#14110f` |
| Default border | `--border-default` | `--color-gray-200` | `--color-gray-700` |
| Primary text | `--text-primary` | `--color-gray-900` | `--color-gray-50` |
| Secondary text | `--text-secondary` | `--color-gray-600` | `--color-gray-300` |

Semantic colors (`--color-success-500`, `--color-warning-500`,
`--color-danger-500`, `--color-info-500`) are for status only — never use
them decoratively. Use the `accent` scale for anything interactive
(links, primary buttons, active states, focus rings).

**Rules:**
- Never write a raw hex value in app code. Import the token.
- Full accent scale (50–900) exists for tints/hovers/text-on-tint — e.g.
  `--color-accent-100` background with `--color-accent-700` text for a
  soft accent badge, never accent-500 background with black text.
- Both themes are defined in `tokens.css`. Toggle by setting
  `data-theme="dark"` on `<html>`; absent that, it follows OS preference.

## Typography

- Font: `--font-sans` (Inter, falls back to system UI stack). Use
  `--font-mono` only for record IDs, code, or raw data values.
- Scale: `--text-xs` (12) → `--text-3xl` (36). Don't pick sizes outside
  this scale.
- Weights: body copy is `--weight-regular`; interactive labels and
  emphasis are `--weight-medium`; headings are `--weight-semibold` or
  `--weight-bold`.
- Line height: `--leading-tight` for headings/UI labels,
  `--leading-normal` for body text, `--leading-relaxed` for long-form
  content (e.g. record descriptions).

| Use | Size | Weight |
|---|---|---|
| Page title (h1) | `--text-3xl` | semibold |
| Section title (h2) | `--text-xl` | semibold |
| Card title (h3) | `--text-lg` | medium |
| Body | `--text-base` | regular |
| Secondary / metadata | `--text-sm` | regular, `--text-secondary` color |
| Caption / timestamp | `--text-xs` | regular, `--text-muted` color |

## Spacing

4px base scale: `--space-1` (4px) through `--space-16` (64px). Layout and
component padding should always land on this scale — no arbitrary `13px`
paddings.

- Tight groupings (icon + label): `--space-2`
- Component internal padding: `--space-4` (compact) to `--space-6` (card)
- Section gaps: `--space-8` to `--space-12`
- Page margins: `--space-12` to `--space-16`

## Radius & elevation

Rounding is generous — it's core to the friendly feel:
- Inputs, buttons, small controls: `--radius-md` (10px)
- Cards, modals, panels: `--radius-lg` (16px)
- Pills, avatars, badges: `--radius-full`

Shadows are soft and used sparingly — only to lift cards/modals off the
page, never to decorate flat elements: `--shadow-sm` default card,
`--shadow-md` hover/dropdown, `--shadow-lg` modal/popover.

## Motion

Fast, subtle, never bouncy: `--duration-fast` (120ms) for hover/press
states, `--duration-base` (200ms) for open/close transitions, always with
`--ease-standard`. Avoid animating layout-affecting properties; prefer
opacity/transform.

## Components

Base components live in `packages/ui`. Extend them rather than building
one-off equivalents in an app:

- **Button** (`Button.tsx`) — variants `primary | secondary | ghost | danger`.
  `primary` for the one main action per view; `secondary` for alternatives;
  `ghost` for low-emphasis/inline actions; `danger` for destructive actions
  (e.g. an admin deleting a record).
- **Card** (`Card.tsx`) — the standard container for a `ServiceRecord` or
  any grouped content. Padding `--space-6`, radius `--radius-lg`.
- **Badge** (`Badge.tsx`) — tones `neutral | accent | success | warning |
  danger | info`. Use for status (record state) and role (e.g. an "Admin"
  tag next to a user's name).

When a new component is needed by more than one app, build it in
`packages/ui`, not inside the app.

## Admin vs. user surfaces

Both roles share the same visual language — no separate "admin theme."
Differentiate by:
- An `accent`-toned `Badge` labeled "Admin" near admin-only controls.
- Placing admin-only actions (create/edit/delete a `ServiceRecord`) behind
  `secondary`/`danger` buttons, reserving `primary` for the page's main
  user-facing action.
- Never color-coding entire admin pages differently — the goal is one
  consistent product, not two skins.

## Accessibility

- Body text must meet WCAG AA contrast against its surface — the default
  gray/accent pairs above are chosen to pass; if you introduce a new
  color pairing, check contrast before using it.
- All interactive elements get a visible focus state via `--focus-ring`
  (already applied in `.btn`; apply the same pattern to any new
  interactive component).
- Don't rely on color alone for status — pair `Badge` tones with a short
  text label.

## How to use this in code

```css
/* apps/<app>/src/app/globals.css */
@import "@service-projects/ui/src/tokens.css";
@import "@service-projects/ui/src/components.css";
```

```tsx
import { Button, Card, Badge } from "@service-projects/ui";

<Card>
  <Badge tone="accent">Admin</Badge>
  <h3>{record.title}</h3>
  <Button variant="primary">View</Button>
</Card>
```

Changing a token updates every app at once. If a design decision isn't
captured here yet, add it here before shipping the one-off.
