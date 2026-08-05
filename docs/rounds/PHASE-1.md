# Phase 1 — Seasons, events, and the flag signup (partial)

Status: **a real, verified slice — not the full phase.** SPEC.md §21's
Phase 1 acceptance criterion is "a household on a real phone picks three
holidays, pays with a Stripe test card, and lands as an `ACTIVE`
subscription... and closing the tab mid-Checkout still resolves correctly
from the webhook." This doc covers the data layer and the first screen of
that flow (the holiday picker). Address entry, Stripe Checkout, the
webhook, and the confirmation email are not built yet — see "What's not
built" below.

This was built in the same unattended session as Phase 0, per the
go-ahead to keep going and document as I go. Nothing here was blocked on
a real decision except the two already flagged in
`docs/rounds/OPEN-QUESTIONS.md` (pricing, legal entity) — both still
placeholdered, not re-litigated here.

## What was built

### Schema: the flag subscription model (SPEC.md §4)

One more migration, `20260805071500_flag_subscription_model`, purely
additive, applied and verified the same way as Phase 0's: `Season` (sits
above `Event` — one season, many holiday events), `Subscription` (one per
household per season), `SubscriptionEvent` (the join that carries
`skipped`, per §4.1 — a household skipping one holiday without cancelling
is a flag on this row, not a deleted record).

### `packages/database/src/scoped/seasons.ts` + `organizations.ts`

`currentSeasonForOrg(orgId)` — not session-gated like the other scoped
helpers, because a season's holidays and prices are exactly what the
public, no-account signup page needs to show (SPEC.md §3.2). Still lives
in `scoped/` rather than a raw `prisma.season` call in app code, for
consistency, not because this particular data is sensitive.

`defaultOrganization()` — there's no subdomain/tenant-resolution
mechanism yet, and this app's real-world scope is one organization
(SPEC.md §22.1). Every public page resolves "the" org through this
until multi-tenant routing is actually needed. Same category of
simplification as `resolveMembership`'s OWNER/ADMIN shortcut, flagged the
same way.

### `apps/rounds/src/lib/holidays.ts` — real calendar math, verified

SPEC.md §4.2's default holiday list (Presidents Day, Memorial Day, Flag
Day, Independence Day, Pioneer Day, Labor Day, Veterans Day), dated using
standard US-federal-holiday-style rules (nth-weekday-of-month,
last-weekday-of-month), not hand-typed dates.

**Checked against the mockup and found a real discrepancy, worth
recording:** for 2027 (the year `Rounds Screens.dc.html`'s mockup 1a
uses — Presidents Day "Mon 15 February" and Memorial Day "Mon 31 May"
both match exactly), the mockup's other three dates are internally
inconsistent with each other: it shows Flag Day and Independence Day both
as "Sunday" and Pioneer Day as "Friday," but if July 4 is a Sunday, June
14 (20 days earlier) must be a Monday and July 24 (20 days later) must be
a Saturday, not Friday — a real calendar can't produce all three at once.
The mockup's dates were evidently illustrative, not computed. This app's
dates are computed for real (verified with a standalone script before
trusting them in the UI: `presidents_day → Mon 15 Feb 2027`,
`memorial_day → Mon 31 May 2027`, `flag_day → Mon 14 Jun 2027`,
`independence_day → Sun 4 Jul 2027`, `pioneer_day → Sat 24 Jul 2027`,
`labor_day → Mon 6 Sep 2027`, `veterans_day → Thu 11 Nov 2027`) and are
authoritative over the mockup's labels.

### `apps/rounds/src/lib/eventKinds.ts`

SPEC.md §2.1's module matrix and per-kind outcome sets, as data —
`MODULE_DEFAULTS` and `OUTCOME_SETS` keyed by `EventKind`. Not wired into
an actual event-creation admin screen yet (that's the rest of Phase 1);
built now so the seed script's holiday events and any future admin
"create event" action share one source of truth instead of two
hand-typed copies.

### `packages/geo` — the UGRC provider interface (SPEC.md §9.1)

New package: `GeoProvider` interface (`geocode`, `reverseGeocode`,
`autocomplete`, `addressPointsInPolygon`), `UgrcProvider`, `MockProvider`,
and `getGeoProvider()` — returns `UgrcProvider` if `UGRC_API_KEY` is set,
`MockProvider` otherwise (same guarded-fallback pattern as the auth
providers).

**SPEC.md is explicit that this needs verifying against gis.utah.gov
before being built, not guessed** — that was attempted for real, not
skipped:
- WebFetch against `gis.utah.gov` and `api.mapserv.utah.gov` (the docs
  pages, and the raw OpenAPI JSON spec) returned HTTP 403 from this
  environment on every path tried — looks like bot protection, not a
  missing page.
- WebSearch surfaced a real, sourced example URL from a UGRC blog post:
  `https://api.mapserv.utah.gov/api/v1/geocode/123 S Main St/Salt Lake City?spatialReference=4326&apiKey=...`
  — confirming the path shape (`street` and `zone` are **path segments**,
  not one combined query param) and that the match score is documented
  as 0–100.
- `UgrcProvider.geocode()` is built against that verified shape. The
  response JSON field names it reads (`result.location.x/y`,
  `result.score`, `result.matchAddress`) are the commonly-documented
  AGRC/ArcGIS response shape, **not confirmed against a live response** —
  there's no API key in this environment to actually call it.
- `reverseGeocode`, `autocomplete`, and `addressPointsInPolygon` are
  deliberately **not implemented** — each throws a clear error explaining
  why, rather than guessing three more endpoint shapes with no way to
  test them. Get a real UGRC key (register at developer.mapserv.utah.gov)
  and confirm each at api.mapserv.utah.gov/docs/ before filling these in.

### The flag signup page — built, styled, and verified in a real browser

`apps/rounds/src/app/(public)/signup/page.tsx` (server component, fetches
the org's current season + its open holiday events) +
`HolidayPicker.tsx` (client component: selection state, running total,
one-tap toggle). This is `Rounds Screens.dc.html`'s mockup **1a**, built
against real seeded data instead of copied from the mockup's markup —
the README's instruction was to recreate the visual output, not the
prototype's internal structure.

**Verified with a live browser, not just "should look right":** started
`next dev`, drove it with Playwright against the pre-installed Chromium,
and read the screenshots back directly (multimodal, not just "the build
passed"):
- Unselected state matches: real computed holiday dates and $12 prices,
  "Most popular" badge on Pioneer Day, $0.00 total, disabled Continue.
- Clicked three cards (Memorial Day, Independence Day, Pioneer Day) and
  confirmed the selected state matches the mockup: accent-tinted card,
  2px accent border, checkmark, semibold name, accent-600 date,
  accent-700 price, `$36.00` running total, correct
  ICU-plural copy ("3 holidays selected"), Continue now enabled in full
  accent color.
- Caught and fixed a real bug this way: neither app in the repo actually
  loaded the Inter webfont — `tokens.css` references `"Inter"` by name in
  `--font-sans`, but with nothing loading it, every app was silently
  falling back to the system UI stack. Added the same Google Fonts
  `<link>` the design bundle's own reference HTML uses, and confirmed via
  `document.fonts.check('16px Inter')` in the running page (not just
  "the link tag is present") that it's genuinely active. Screenshots
  above are from *after* this fix.

### `packages/ui` — `Button` `size="lg"` (SPEC.md §12.2)

Added the exact addition SPEC.md §12.2 calls for: `size="lg"` → 48px min
height, `--text-base`, "every button a volunteer taps outdoors." Used for
the signup page's Continue button rather than a one-off styled button —
"extend it; do not fork it," same rule Phase 0 followed.

## Update: address entry, contact/review, and the write path (second session)

Built in a later session, continuing this same phase:

- **Address entry** (stepper step 2): a text field that calls
  `geocodeAddress` (new `apps/rounds/src/app/(public)/signup/actions.ts`)
  on change, showing the returned approximate lat/lng with editable
  number inputs the visitor can nudge — the "drop a pin" fallback SPEC.md
  §7.3 calls for, built without a map widget since there's no mapping
  API key in this environment either. Goes through `getGeoProvider()`
  exactly as `packages/geo` already intended, so it starts returning real
  UGRC results the moment `UGRC_API_KEY` is set — no app code changes
  needed.
- **Contact + placement note, and review** (stepper step 3): name,
  email, phone, placement note, access notes, plus a review card
  (holidays, address, total) before submitting.
- **The `Household`/`Subscription`/`SubscriptionEvent` write path**:
  `submitSignup` in `packages/database/src/scoped/households.ts` (public,
  unauthenticated — same reasoning as `currentSeasonForOrg`) creates a
  real `Household` and a `Subscription` with one `SubscriptionEvent` per
  selected holiday. Submitting now creates real rows, not a no-op button.

**Still honest about what this isn't:** the created `Subscription` is
left in `PENDING_PAYMENT`, not `ACTIVE` — there's no Stripe integration,
so nothing has actually been paid. The signup's copy says as much
(`signup.contact.paymentNote`) rather than implying payment happened.

## Update: admin event/season creation UI (third session)

Built `apps/rounds/src/app/admin/events/` (OWNER/ADMIN only, same
`requireRole` + preview-role pattern as `/admin/users`):

- **Generate this year's flag season** — one form (org name, year, price
  per holiday), one submit. `generateFlagSeason` in
  `apps/rounds/src/app/admin/events/actions.ts` creates the org if it
  doesn't exist yet (`getOrCreateDefaultOrganization`, new in
  `packages/database/src/scoped/organizations.ts`), a `Season`, and the 7
  standard holiday `Event`s — real dates via the existing
  `FLAG_HOLIDAYS`/`holidaysForYear` from Phase 1's first session, and the
  exact same naming convention (`slug: ${key}-${year}`, `name: ${label}
  ${year} — Flag Set-Out`) the seed script used by hand, so
  `/signup` picks these up with zero changes. This is the direct fix for
  "there's no signup yet" — that page was correctly showing its
  not-found state because no `Organization`/`Season`/`Event` rows existed
  outside the seed script, which only ever ran against a local dev
  database, never this app's real Neon database.
- **Create a custom event** — a second, simpler form (name, kind, start/
  end) for anything outside the standard flag season (a fundraiser, a
  flyer delivery), using `MODULE_DEFAULTS`/`OUTCOME_SETS` from
  `eventKinds.ts` for whichever kind is picked. No per-field
  module/outcome override UI yet — SPEC.md §2.1 allows one, not built.
- A read-only table of the current season's events underneath both
  forms.

New write primitives, following the same "scoped/ owns the Prisma call,
caller owns the auth gate" split as everything else here:
`getOrCreateDefaultOrganization` (organizations.ts), `createSeason` +
`seasonForYear` (seasons.ts), `createEvent` (events.ts).

## Update: real map for the address step (fourth session)

Replaced the raw lat/lng number inputs with an actual map: Leaflet +
OpenStreetMap tiles (`apps/rounds/src/app/(public)/signup/AddressMap.tsx`)
— free, no API key or billing, attribution-only, loaded via
`next/dynamic` with `ssr: false` since Leaflet touches `window` at import
time. A draggable pin shows the geocoded location; dragging it calls the
new `reverseGeocodeCoords` action to show the address at that point.

**Two real bugs found and fixed while wiring this up, not just
theoretical:**

1. `UgrcProvider.geocode()` throws without a `zone` (city/ZIP) argument —
   nothing was passing one, so every geocode call would have thrown the
   moment the real UGRC key (added this session, see below) became
   active. Added a required "City or ZIP" field to the address step and
   threaded it through `geocodeAddress(addressLine, zone)`.
2. `UgrcProvider.reverseGeocode()` is unimplemented by design (its
   endpoint shape was never verified — see `packages/geo/src/ugrc.ts`)
   and throws. `reverseGeocodeCoords` now catches that and returns
   `null` instead of crashing the request; the UI keeps showing the last
   known address rather than erroring. Dragging the pin updates the
   address live under `MockProvider`; under real UGRC it currently
   doesn't (falls back to the original geocoded address) until someone
   verifies and implements `UgrcProvider.reverseGeocode` for real.

**`UGRC_API_KEY` was added to the live Vercel project this session.**
`getGeoProvider()` should now return the real `UgrcProvider` there
instead of `MockProvider`. Its `geocode()` response parsing was built by
reading UGRC's documented shape, not verified against a live call (no
key existed anywhere until now) — the first real `/signup` address entry
on the deployed app is the actual test of this, not anything run in this
repo's sandbox (which also can't reach UGRC's IP-restricted key
correctly without the key value itself).

## What's still not built (the rest of Phase 1)

- **Stripe Checkout, webhook, confirmation email.** No Stripe keys exist
  in this environment; the integration shape is well-documented in
  SPEC.md §10 and wasn't started, to avoid writing untested payment code.
  This is the reason `Subscription.status` stops at `PENDING_PAYMENT`.
- **`UgrcProvider.reverseGeocode`.** Still throws by design (unverified
  shape) — dragging the map pin degrades gracefully instead of updating
  the shown address when real UGRC is active. Verify UGRC's reverse
  geocode endpoint shape before implementing.
- **Household de-duplication.** Every submission creates a new
  `Household` row, even for a repeat signup from the same address —
  matching/merging logic isn't built (would matter more once renewals
  and Phase 2's stop generation exist).
- **Editing or deleting a season/event.** The admin screen only creates;
  fixing a typo in a generated event currently means going to the
  database directly.

## Verification performed

1. Migration generated via `prisma migrate diff` against the same local
   Postgres + PostGIS instance from Phase 0, applied via `migrate
   deploy`, client regenerated. Diff was clean/additive — no hand-fixing
   needed this time (unlike Phase 0's enum migration).
2. Seed script extended to create the season and its 7 holiday events for
   real, re-run, and the resulting rows queried back
   (`Season.pricingMode = per_holiday`, `priceCents = 1200`, all 7 events
   with correct slugs and dates).
3. `tsc --noEmit` clean on every package (`database`, `core-auth`, `geo`,
   `ui`, both apps).
4. `next build` and `next lint` clean for both apps via `turbo run
   build`/`turbo run lint` at the root — zero warnings, including after
   fixing the font lint warning properly rather than suppressing it
   blind.
5. `check:copy` clean (17 keys, all with defaults).
6. Live browser verification via Playwright + the pre-installed
   Chromium, screenshots read back directly: unselected state, then the
   selected-holidays interaction state, both checked against
   `Rounds Screens.dc.html` mockup 1a.

**Second session (address/contact/write-path) verification — narrower,
noted honestly:** this session's sandbox has no route to raw Postgres
(port 5432 is blocked; only outbound HTTPS/443 is reachable), so a live
`next start` against the real Neon database — and therefore Playwright
verification against real rendered data — wasn't possible here. What was
actually run: `check:copy` (91 keys, all with defaults), `tsc --noEmit`
clean, `next build`/`next lint` clean via Turborepo, and a manual read of
the generated route output confirming `/signup` still builds as an SSR
route. The multi-step flow's actual on-screen behavior (address
geocoding round-trip, review step, submit) has **not** been eyeballed in
a live browser this session — treat it as "builds and type-checks clean"
confidence, not "confirmed working in a browser" confidence, until
someone with real DB access loads `/signup` and clicks through it.

## Files touched (on top of Phase 0, and on top of the first Phase 1 session)

```
packages/database/
  prisma/schema.prisma                                  (+ Season, Subscription, SubscriptionEvent, SubStatus)
  prisma/migrations/20260805071500_.../migration.sql     (new, additive)
  prisma/seed.mjs                                        (+ season + 7 holiday events)
  src/scoped/seasons.ts, organizations.ts                (new)
  src/scoped/index.ts                                    (+ exports)

packages/geo/                                             (new package)
  package.json, tsconfig.json
  src/types.ts, ugrc.ts, mock.ts, index.ts

packages/ui/
  src/Button.tsx                                          (+ size prop)
  src/components.css                                      (+ .btn-lg)
  tsconfig.json                                            (new)

apps/rounds/
  src/lib/eventKinds.ts, holidays.ts, format.ts            (new)
  src/app/layout.tsx                                       (+ Inter webfont — was missing repo-wide)
  src/app/globals.css                                      (+ .signup-* classes, incl. field/review/hint/error)
  src/app/(public)/signup/page.tsx                          (+ orgId/seasonId/event.id passed through)
  src/app/(public)/signup/SignupFlow.tsx                    (new — replaces HolidayPicker.tsx, adds address/contact/review steps)
  src/app/(public)/signup/actions.ts                        (new — geocodeAddress, submitSignup)
  src/copy/en.ts                                            (+ signup.* keys)

packages/database/
  src/scoped/households.ts                                  (+ SignupSubmission, submitSignup)
```

## Next

Address entry (pin-drop fallback first, since it doesn't need UGRC),
then Stripe Checkout once test keys exist, then the webhook. See
`docs/rounds/OPEN-QUESTIONS.md` for what's still genuinely blocking
(pricing, legal entity, UGRC/Stripe credentials).
