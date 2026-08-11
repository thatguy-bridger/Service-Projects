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

## Update: swapped Leaflet/OSM for Google Maps (fifth session)

The Leaflet + OpenStreetMap picker from the previous session was
replaced outright — `apps/rounds/src/app/(public)/signup/AddressMap.tsx`
deleted, `leaflet`/`react-leaflet` removed from
`apps/rounds/package.json`. New:
`apps/rounds/src/app/(public)/signup/GoogleAddressPicker.tsx`, built on
`@vis.gl/react-google-maps` (Google's own React wrapper):

- **Autocomplete-as-you-type** via the classic
  `google.maps.places.Autocomplete` widget, not the newer
  `PlaceAutocompleteElement` — a deliberate choice. The classic widget is
  a decade-stable, thoroughly documented API, and Google's 2024 migration
  bills it under Places API (New) SKUs anyway (which this project
  enabled), so there was no billing reason to reach for the newer,
  less-proven surface, especially given this couldn't be live-tested in
  a browser from this environment.
- **Draggable pin + live reverse geocoding**, both via Google's own
  `Geocoder` — this replaces the UGRC-based `reverseGeocodeCoords`
  server action entirely, so the previous session's "drag doesn't update
  the address under real UGRC" limitation is gone: reverse geocoding now
  always works, since it's Google's, not UGRC's unimplemented endpoint.
- `apps/rounds/src/app/(public)/signup/actions.ts` lost `geocodeAddress`
  and `reverseGeocodeCoords` — the whole UGRC/`@service-projects/geo`
  round trip for this screen is gone. That package and its
  `UGRC_API_KEY`-backed provider are untouched and still exist for other
  Utah-specific territory work SPEC.md §9 describes (territory fill,
  address-points-in-polygon) — just not used by the signup address step
  anymore.
- New env var: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (must be
  `NEXT_PUBLIC_`-prefixed — it's read in the browser, unlike the app's
  other, server-only secrets). Added to the live Vercel project this
  session. **Not live-tested in a browser** — same sandbox constraint as
  every UI change in this doc (see the second session's note above); the
  first real `/signup` visit on the deployed app is the actual test.

## Update: onboarding chooser, tabbed admin shell, responsive pass (sixth session)

**`/welcome` — the "what brings you here" chooser.** New `User.onboardedAt`
(nullable, migration `..._add_onboarded_at`) tracks whether an account
has picked what it's here to do. `apps/rounds/src/app/page.tsx` redirects
any signed-in account with real role `PREVIEWER` and no `onboardedAt` to
`/welcome` — Owner/Admin/Coordinator/Volunteer accounts already have a
defined position and are never redirected there. Two choices:
"I want a service" marks onboarded and sends them to `/signup`; "I want
to help organize or volunteer" marks onboarded and sends them home with
a thank-you note. The volunteer path is honest about a real limitation:
**there's no invite-key redemption system yet** (that's SPEC.md's
Phase 5) — an Owner/Admin still has to manually grant a role via
`/admin/users` after hearing from someone. `/welcome` says this plainly
rather than pretending a self-serve flow exists.

**Tabbed admin shell.** `/admin/*` had two near-duplicate pages, each
re-implementing the same topbar, role-preview gate, and forbidden-preview
view. Extracted into `apps/rounds/src/app/admin/layout.tsx` (the one real
`requireRole` gate, shared by every admin page) + `AdminTabs.tsx` (Events
/ Users, active-tab underline, horizontally scrollable if a phone can't
fit both). `/admin/users` and `/admin/events` now only render their own
content — same behavior, half the code, easier to add a third admin
section later without repeating the gate again.

**Responsive pass.** New `.admin-shell` (max-width 1180px) instead of
reusing the narrower 720px `.rounds-shell` for admin screens — tables and
side-by-side forms get real room on a laptop/desktop instead of being
squeezed into a mobile-first column. `.admin-columns` (auto-fit grid) for
the two event-creation forms, `.admin-tableWrap` (`overflow-x: auto`)
around every admin table so a wide table degrades to a horizontal scroll
on a phone instead of breaking the page layout, `flex-wrap: wrap` added
to `.rounds-topbar` (role badge + preview switcher + account controls
could overflow on narrow screens before this). `.signup-shell` (480px)
was deliberately left narrow — a stepped public form reads better
constrained on any device, phone or desktop, than stretched full-width.

**Not attempted:** a genuine per-breakpoint visual QA pass. Every change
above is a real, standard responsive pattern (fluid containers, CSS grid
auto-fit, flex-wrap, scrollable tables), but none of it has been looked
at in an actual browser at actual phone/tablet/desktop widths — same
sandbox constraint noted in every UI session in this doc. Worth an actual
look on a phone before calling this done.

## Update: per-event data drill-down + CSV export (seventh session)

The point of the admin flow, restated by the user mid-session: an event
*is* its own dataset — click into one, see only that event's signups,
not the whole org's. Built:

- `packages/database/src/scoped/households.ts` gained
  `householdsForEvent(session, orgId, eventId)` — everyone signed up for
  one specific event (joins `SubscriptionEvent` → `Subscription` →
  `Household`, staff-gated same as the rest of this file).
- New `apps/rounds/src/app/admin/events/[eventId]/page.tsx`: that
  event's name/date/status, three stat cards (signups, skipped, total
  amount), and a table of households with contact/address/status. Linked
  from each row in the `/admin/events` list.
- New `apps/rounds/src/app/admin/events/[eventId]/export/route.ts`: CSV
  download of that event's households. A Route Handler, not a page, so
  it needs its own `requireRole` call — it isn't wrapped by
  `admin/layout.tsx`'s gate the way pages under `admin/` are.

Both real security-gated via `eventForSession`'s membership check (an
Owner/Admin always passes; SPEC.md §3.3's event-scoped Coordinator role
would too, once actually assigned via Membership).

**Not built this round, on purpose — asked, not guessed:** CSV *import*
(bulk-adding/updating households from an uploaded file) and JSON
export/import for full per-event backup/restore. The user was asked to
choose scope and the question was interrupted; proceeded with the
minimum useful slice (read + CSV export) rather than guessing at import
semantics (dedupe rules? overwrite vs. merge? validation on bad rows?)
that are easy to get wrong and hard to undo once someone's uploaded a
file. Confirm with the user before building either.

## Update: CSV import, and the answer on data isolation (eighth session)

The user clarified the intended model directly: user accounts stay
shared across every event, but everything else should be "almost fully
separate" per event, with the ability to copy data from one event into
another when needed. That's what's actually built as of the seventh
session (`householdsForEvent` already scopes strictly to one event) —
nothing needed to change there. What was missing was the "copy when
needed" half, now closed:

- `packages/database/src/scoped/households.ts` gained
  `importHouseholdsForEvent(session, input)` — bulk-creates/updates
  Households + a Subscription + a SubscriptionEvent from a CSV, using the
  **same column contract as the export route** (Name, Email, Phone,
  Address, Placement note, Access notes, Amount, Status, Skipped), so
  export → edit → import round-trips, and exporting event A + importing
  into event B is literally how "copy from another event" works — no
  separate clone feature needed.
- Dedup rule: an Email that matches an existing Household in the org
  (case-insensitive) updates that household in place; otherwise a new
  one is created. No address-based fuzzy matching — deliberately, since
  a wrong fuzzy match silently merges two different households.
- A bad row (missing Name/Address) is skipped and reported by row
  number, not aborted — one bad row shouldn't block the rest of a real
  import. Errors are shown back in the UI, not swallowed.
- Only available on events that have a `seasonId` — events created via
  "Create a custom event" (fundraiser, flyer delivery, etc.) don't use
  the Household/Subscription model at all yet, so import is hidden for
  those with an explanation rather than silently failing.
- Staff-gated independently inside `importHouseholdsForEvent` itself
  (not just in the calling server action) — a write like this shouldn't
  rely on every future caller remembering to check first.

## Update: Events → category → opportunity directory + per-opportunity people (ninth session)

The user restated the model directly, and it's a renaming/reorganization
more than a new data shape:

- **"Events"** (top-level) is now a real directory:
  `/admin/events` shows category tiles (Flag Setup, Flag Takedown, Flyer
  Delivery, Fundraiser, Pickup Collection — `EVENT_KIND_LABELS` in
  `apps/rounds/src/lib/eventKinds.ts`) with a count of opportunities in
  each, linking to `/admin/events/category/[kind]`.
- **"category"** groups what the schema already calls `EventKind` — no
  new column needed, this was always there, just not exposed as a
  browsable grouping.
- **"opportunity"** is what the rest of this doc has been calling
  "event" — an individual `Event` row (e.g. one specific holiday's
  set-out). `/admin/events/category/[kind]` lists them; clicking one
  still goes to the existing `/admin/events/[eventId]` detail page,
  unchanged.
- Route note: `[eventId]` and `[kind]` can't be sibling dynamic segments
  under the same folder — Next.js requires every dynamic segment at one
  level to share a param name. Nested `[kind]` under a static `category/`
  folder instead of renaming `[eventId]`.

**Per-opportunity people**, closing the other half of what was asked
("different sets of people per event, shared across the org's
admin/volunteer/user pool"): `packages/database/src/scoped/membership.ts`
gained `membershipsForEvent`/`addEventMembership`/`removeEventMembership`
— the `Membership` model already had `eventId` (SPEC.md §3.3 always
intended one person to hold different roles on different events); there
was just no UI to actually grant one. New "People on this opportunity"
card on `/admin/events/[eventId]`: add someone by email + Admin/
Coordinator/Volunteer role (creates their `User` row if they don't have
one yet, same pre-create-by-email pattern as `/admin/users`), list/remove
current grantees. `User` accounts themselves stay global/shared, exactly
as asked — only the `Membership` role assignment is event-scoped.

**Named but not built this round:** the user separately asked for a
"massive data library" — an org-wide household pool to pick-and-copy
from into any event, beyond today's export-one/import-into-another CSV
round trip. Real scope (browsing all org households, a picker UI,
copy-selected-into-event) big enough to be its own piece of work, not
squeezed into this session.

## Update: the household data library (tenth session)

Closes the gap flagged at the end of the last session. New
`/admin/library` tab (added to `AdminTabs.tsx`):

- **Search** — `searchHouseholds(session, orgId, query)` in
  `packages/database/src/scoped/households.ts`, matching name/email/
  phone/address (case-insensitive `contains`), capped at 50 results. A
  plain `GET ?q=` form, so it works with no client JS; only the
  results/copy step below it needs any.
- **Copy** — check the households you want, pick an event from a
  dropdown (only events that have a season, same constraint as CSV
  import), submit. `copyHouseholdsToEvent` upserts a
  `Subscription` + `SubscriptionEvent` per selected household directly —
  no CSV round trip. Amount defaults to that event's season price
  (`per_holiday` pricing) or 0 otherwise; same `PENDING_PAYMENT` honesty
  as every other write path here, since there's still no Stripe
  integration.
- Both are staff-gated inside the scoped functions themselves, same
  pattern as `importHouseholdsForEvent`.

This and CSV export/import are now two ways to do the same underlying
thing ("get households from somewhere into this event") — CSV for
editing/sharing outside the app, the library for reusing what's already
here without leaving the browser.

## What's still not built (the rest of Phase 1)

- **Stripe Checkout, webhook, confirmation email.** No Stripe keys exist
  in this environment; the integration shape is well-documented in
  SPEC.md §10 and wasn't started, to avoid writing untested payment code.
  This is the reason `Subscription.status` stops at `PENDING_PAYMENT`.
- **Invite-key redemption** (SPEC.md Phase 5). `/welcome`'s volunteer
  path is a stated interest, not a grant — an Owner/Admin still assigns
  the role by hand in `/admin/users`.
- **Import for non-season events.** A fundraiser/flyer-delivery event
  has no Household/Subscription data model yet — that's Phase 2+'s
  Stop/Signup/Visit models, not built.
- **Household de-duplication beyond exact-email matching.** A repeat
  signup with no email, or a different email, still creates a new
  `Household` row — real fuzzy matching isn't built (would matter more
  once renewals and Phase 2's stop generation exist).
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

## Update — bulk selection tools + Library rework

Added checkbox-based multi-select with bulk actions everywhere admin data
is listed, and rebuilt the Library page into a full browse/sort/paginate
table instead of a search-only view.

- **Users list** (`admin/users`): select-all + bulk delete (`UsersTable.tsx`).
  Hard-deletes per row with try/catch (User has no `deletedAt` and has FK
  dependents), reports per-row failures rather than aborting the batch.
  Owner/self-delete are blocked server-side.
- **Opportunities list** (`admin/events/category/[kind]`): select-all +
  bulk delete (`OpportunitiesTable.tsx`), soft-delete via `Event.deletedAt`.
- **Event detail → People**: bulk "remove selected" replaces the old
  per-row remove button (`PeopleForm.tsx`), sets `Membership.status =
  "removed"` for all selected rows in one `updateMany`.
- **Event detail → Households** (`HouseholdsTable.tsx`, new): select-all +
  bulk "Remove from event" (hard-deletes the `SubscriptionEvent` join row,
  which has no dependents so this is always safe) + bulk "Copy to another
  event" (dropdown of other events with a season, reuses
  `copyHouseholdsToEvent`).
- **Library** (`admin/library`): now shows *all* households by default
  (paginated, 50/page) via new `browseHouseholds()`, not just search
  results — `query` narrows instead of gating. Column headers sort via
  GET params (`?sort=&dir=`), a client-side column-visibility toggle
  hides/shows Name/Contact/Address/Placement note/Access notes/Created,
  and it gained bulk delete (soft-delete via `deleteHouseholds()`)
  alongside the existing bulk copy-to-event.

`browseHouseholds()` replaces the old `searchHouseholds()` — same
staff-only gate, now paginated/sorted and query-optional.

## Next

Address entry (pin-drop fallback first, since it doesn't need UGRC),
then Stripe Checkout once test keys exist, then the webhook. See
`docs/rounds/OPEN-QUESTIONS.md` for what's still genuinely blocking
(pricing, legal entity, UGRC/Stripe credentials).

## Update — admin editing + new Settings section

Follow-up to "unlimited access for admins": scoped via clarifying
questions to (1) real field-level editing, not just create/delete, and
(2) surfacing models that had no admin UI at all yet.

- **Households**: each Library row now links to `/admin/library/[id]`,
  a full edit page for every field (name/email/phone/address/placement
  note/access notes) via new `updateHousehold()`.
- **Events**: the event detail page gained an edit form (name/status/
  start/end) via new `updateEvent()` — previously status could only be
  set at creation.
- **New "Settings" admin tab** (`admin/settings`): the first UI at all
  for two models that only ever had internal read helpers —
  **Organization** (rename) and **Seasons** (every season ever created,
  editable name/price-per-household inline) via new `updateOrganization()`
  and `updateSeason()`/`allSeasonsForOrg()`.

Not done in this pass, deliberately deferred: editing Subscription/
Membership rows directly (their state is derived from signups/CSV import
and role changes respectively — editing them out-of-band risks
desyncing status from the actions that are supposed to drive it) and a
generic "edit any model" browser. If per-subscription status editing
turns out to be wanted (e.g. manually marking one paid/skipped outside
the normal flow), that's a scoped follow-up, not a guess to make here.

## Update — signup address manual fallback + single-row editing everywhere

Two follow-ups: the signup flow's address step had no path forward at
all if `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` was unset (just an error
message, dead-ending the whole signup) — now it falls back to a plain
text address field (`GoogleAddressPicker.tsx`'s `ManualAddressEntry`),
and either path can switch to the other via a link ("enter manually" /
"use the map"). Manual entries save with `lat`/`lng` unset and
`geocodeSource: "manual"`, distinguishing them in the data from a real
geocoded pin.

Every admin table that only had bulk actions now also has single-row
editing, not just bulk:
- **Users**: inline name + role editor per row (`UserRowEditor`),
  distinct from the existing email-lookup role-grant form — same
  Owner-role guard rails as before.
- **Opportunities list**: an explicit "Edit" link per row to the event
  detail page's edit form (added last session).
- **Event detail → People**: inline per-person role editor
  (`PersonRoleEditor`, new `updateEventMembershipRole()`), replacing the
  old static role badge.
- **Event detail → Households**: an "Edit" link per row to the
  household's detail/edit page under Library.

Also removed `removeEventPerson` (the old single-row remove action),
dead since PeopleForm switched to bulk-only removal last session — and
its now-unused `removeEventMembership` import.

One build-breaking gotcha worth documenting: `UsersTable.tsx` initially
imported `ROLES` from `@service-projects/core-auth`'s barrel — that
package's `index.ts` also exports `authOptions`, which pulls in
`nodemailer` (a server-only dependency), and breaks the client bundle.
Fixed by duplicating the small `ROLES` const locally in the client
component instead, same as `EVENT_ROLES` already does elsewhere.

## Update — consistent navigation, free address map, signup layout

Direct response to a user-compiled feedback sheet (feature-request rows,
not a code review): navigation was inconsistent across screens, "view
as" wasn't useful, and the signup address step had no way to see or
confirm the pin.

- **One shared topbar** (`AppTopbar.tsx`, new): every screen — home,
  welcome, register, signup, admin — now renders the same header:
  brand/home link, current section, an "Admin" shortcut for staff, the
  effective role badge, the preview switcher (Owner/Admin only), and
  account controls. Before this, `/signup` and `/register` had no
  topbar at all, and home/welcome/admin each hand-rolled their own
  slightly different copy of one — the actual root cause of "no matter
  which screen I'm on" not holding true. This is a straight duplication
  removal, not new UI language.
- **"View as" (role preview)**: the admin-forbidden view previewing as
  a non-staff role now explains plainly that a real account in that
  role never sees this screen and links straight to what they *would*
  see (`/` as that role), instead of just stating the page is
  admin-only. The role badge in the topbar also now always shows the
  real/previewed role rather than hiding it behind a generic
  "Previewer" label for non-staff — the badge answering "who am I right
  now" consistently was the missing piece, not new preview logic.
- **Signup layout**: the stepper itself is untouched (mobile-first is
  still correct there), but on viewports ≥900px it now sits inside the
  app's normal topbar chrome next to a season/holiday summary side
  panel, instead of floating alone in a 480px column with empty gray
  gutters on either side and no way back into the rest of the app.
- **Address confirmation + pin-drop, without any API key**: replaced
  the Google Maps-dependent picker (which, with no
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` configured, degraded to a plain
  text field with no map at all) with `OSMAddressPicker.tsx` — address
  search via Nominatim (OpenStreetMap's free geocoder, no key, no
  billing account) and a Leaflet map with a draggable pin using OSM's
  public tile servers. This works out of the box in every environment;
  no credential to request from anyone. Dropped the
  `@vis.gl/react-google-maps` and `@types/google.maps` dependencies
  entirely along with the now-dead `GoogleAddressPicker.tsx`. New
  dependency added: `leaflet` (~150KB, dynamically imported client-side
  only so it doesn't load until the address step) + `@types/leaflet`
  (dev-only). Nominatim's usage policy caps unauthenticated browser use
  around 1 request/second; the search input debounces at 400ms, well
  under that, and this app's real signup volume is nowhere near the
  ceiling — if that ever changes, everything routes through one fetch
  helper in `OSMAddressPicker.tsx` that's easy to point at a paid or
  self-hosted geocoder instead.

Deliberately not attempted this session: the rest of `SPEC.md`'s Phase
2+ scope (form builder, route builder, PostGIS territory fill, Stripe,
invite keys, layout blocks, multi-language). That document itself says
not to attempt it in one pass — phase by phase, with a go-ahead between
each. This session's concrete, scoped feedback (navigation, view-as,
address/pin-drop) was the actionable subset; the rest stays the
roadmap for follow-up sessions.

## Update — Google Maps address picker restored, key-driven

The user has a Google Maps API key configured (`NEXT_PUBLIC_GOOGLE_MAPS_API`
— note: no `_KEY` suffix, confirmed directly by the user, not assumed).
`AddressPicker.tsx` (new) now dispatches: `GoogleAddressPicker.tsx`
(restored, unchanged logic) when that env var is set, `OSMAddressPicker.tsx`
otherwise. Same call site in `SignupFlow.tsx` either way — nothing else
had to change. `geocodeSource` on the submitted household records which
path actually produced the pin (`google` / `osm` / `manual`), so Library
rows stay honest about provenance regardless of which key is configured
in a given environment.

## Update — standardized on Places API (New)

The key's API restrictions only listed Places API (New), which broke
autocomplete with `ApiTargetBlockedMapError` — the classic
`google.maps.places.Autocomplete` widget this app used depends on the
legacy "Places API", a separate API from "(New)" despite the name.
Rather than also enabling the legacy API (which Google has deprecated
for new projects since March 2025 anyway), `GoogleAddressPicker.tsx`
now uses `google.maps.places.PlaceAutocompleteElement` — the
`gmp-select` custom-element replacement that runs on Places API (New).
It isn't wrapped by `@vis.gl/react-google-maps` yet, so it's built with
the DOM directly (create the element, append it, listen for
`gmp-select`, `event.placePrediction.toPlace().fetchFields(...)` for
the formatted address + lat/lng) inside a `useEffect`, the same pattern
`OSMAddressPicker.tsx`'s Leaflet map already uses for a non-React
widget. The draggable-pin reverse-geocode still uses
`google.maps.Geocoder` (the plain Geocoding API, which was never split
into legacy/new) — no change needed there.

## Update — optional account linking for households

Direct follow-up request: after a signup, offer the household a quick
account so a future signed-in visit doesn't retype anything.

- **Schema** (migration `link_household_to_user`, purely additive —
  nullable FK + index, no data touched): `Household.userId String?` →
  `User`. Most households still never link one; the public signup form
  works exactly as before with no account.
- **`householdForUser(userId, orgId)`** (new, `scoped/households.ts`):
  the signed-in household's most recently created linked household, for
  prefill. **`linkHouseholdToUser(householdId, userId, orgId)`** (new):
  links an already-submitted household to the account the household
  creates right after. `submitSignup` now accepts an optional `userId`
  so a signed-in household's submission is linked immediately instead
  of needing the extra link step.
- **Signup page**: reads the session server-side; if the signed-in user
  has a linked household, `SignupFlow` is prefilled (name, email,
  phone, address, placement note, access notes) instead of starting
  blank.
- **Confirmation screen**: if the household wasn't signed in,
  offers "Create an account" (skippable) that deep-links to `/register`
  with their just-entered name/email pre-filled and the new
  household's id attached. `/api/register` now accepts an optional
  `name`. A new `/api/link-household` route (session-gated, links only
  to the caller's own account) is called right after `signIn()`
  succeeds — that's the earliest point a request can carry the fresh
  session cookie, since `signIn()` is a client-side next-auth call a
  server action can't trigger.

Deliberately not built: updating an *existing* linked household in
place on a later signup (each submission still creates a new household
row, linked to the same account) — SPEC.md's household model already
treats each season's submission as its own record via `Subscription`,
and collapsing that into an editable single record per account is a
bigger modeling decision than this request asked for.

## Update — five autonomous, no-input-needed items

Run as a batch while waiting for further direction: engineering work
with no product or credential decision attached.

1. **Real test suite for the scoped access-control helpers**
   (`packages/database/src/scoped/__tests__/`, new Vitest setup —
   `npm run test` at the repo root now runs it via Turbo). This
   sandbox can't reach the real Postgres database, so these are unit
   tests against a hand-built Prisma mock (`mockPrisma.ts`) rather
   than integration tests against real data — they verify the
   *authorization logic itself*: a Volunteer/Previewer gets turned
   away before any query runs, an org-scoped write's `where` clause
   always includes the caller's `orgId` (so an id from a different org
   can't be reached), and `resolveMembership` correctly short-circuits
   OWNER/ADMIN org-wide while resolving event-scoped roles from a
   `Membership` row for everyone else. 32 tests across
   `membership.test.ts`, `households.test.ts`, `events.test.ts` — the
   exact surface SPEC.md §6 asks to be tested.
2. **Loading/error boundaries.** Every route previously rendered a
   blank white page during a server-component fetch and the
   framework's raw crash screen on an error. Added `loading.tsx` +
   `error.tsx` for `/admin`, `/signup`, and the app root (covering
   `/`, `/welcome`, `/register`) — Next.js's built-in convention, no
   new design-system components needed.
3. **Rate limiting on the three public write endpoints**
   (`apps/rounds/src/lib/rateLimit.ts`, new): `submitSignup` (5/10min
   per IP), `/api/register` (10/15min per IP — this route doubles as
   sign-in, so it was previously an unthrottled password-guessing
   oracle against any known email), `/api/link-household` (20/15min
   per IP). In-memory, so **honestly best-effort, not a hard
   guarantee** — Vercel serverless functions don't guarantee the same
   instance handles consecutive requests, so a determined attacker
   spreading requests across cold starts isn't fully stopped. Real
   protection would need a durable store (Vercel KV, Upstash Redis),
   not added since it needs an account/credential this environment
   doesn't have. Still strictly better than the zero limiting these
   endpoints had.
4. **Google address input styling.** Flagged last session as an
   unverified caveat: `PlaceAutocompleteElement` renders its own input
   inside a shadow root, so the `.signup-input` class only styled the
   host box, not the input Google actually renders inside it. Added
   `::part(input)` rules (the CSS part Google's docs document for
   this). **Still not verified in a live browser** — no browser access
   in this environment — so if it still looks mismatched, that's the
   next thing to check, not a sign the approach is wrong.
5. **Dead-code sweep.** Removed two scoped helpers with zero callers
   anywhere in the app (`removeEventMembership` — dead since the
   People list moved to bulk-only removal, noted but not deleted at
   the time; `organizationsForSession` — multi-org scaffolding for a
   feature this app's real-world scope doesn't need, unlike
   `stopsForSession`'s Phase-3 TODO which stays since it's a
   documented near-term target). Kept `householdsForSession` despite
   having no app-code caller — it's now directly covered by the new
   test suite and is a simpler canonical example of the access-control
   pattern than `browseHouseholds`, worth keeping as library API even
   though the Library page itself uses the fuller helper.

## Update — five more autonomous, no-input-needed items

1. **Fixed the real rate-limiting gap.** Last batch's rate limiting on
   `/api/register` didn't actually cover the real credential check —
   the client's follow-up `signIn("credentials", ...)` call lands in
   `next-auth`'s own `authorize()` callback in
   `packages/core-auth/src/authOptions.ts`, a separate code path that
   had no limiting at all. Moved `rateLimit`/`clientIpFromHeaders` from
   `apps/rounds/src/lib` into `packages/core-auth` (shared, so both the
   app's API routes and the auth package itself can use one
   implementation instead of two) and added a 10-attempts/15-min limit
   keyed by email inside `authorize()` — the actual password-guessing
   oracle, now closed.
2. **Test suite for `packages/core-auth`** (new Vitest setup, 28
   tests): `permissions.test.ts` proves `capabilityCard()` can never
   grant something `can()`/`requireRole` would reject (they all read
   the same `PERMISSIONS` table — SPEC.md §3.4's whole point);
   `requireRole.test.ts` (mocking `resolveMembership`) covers the
   top-level-role and event-scoped-membership paths; `password.test.ts`
   covers hash/verify round-trips and the strength floor;
   `rateLimit.test.ts` covers window expiry and IP-header parsing.
3. **Test suite for `apps/rounds`'s pure helpers** (new Vitest setup,
   11 tests): `holidays.test.ts` pins the exact dates verified earlier
   in this doc (`docs/rounds/PHASE-1.md`'s calendar-math check) so a
   future refactor can't silently drift, plus weekday/fixed-date
   invariants across multiple years; `format.test.ts` covers the
   cents/date formatters. `npm run test` at the repo root now runs all
   three packages' suites via Turbo (71 tests total).
4. **`/api/health`** (new): unauthenticated `SELECT 1` liveness check
   for an uptime monitor or load balancer — reveals nothing beyond
   "can this instance reach its database right now."
5. **Baseline security headers** (`next.config.js`): `X-Content-Type-
   Options`, `X-Frame-Options: DENY`, `Referrer-Policy`. Deliberately
   did **not** add a Content-Security-Policy — this app loads Google
   Maps scripts and OpenStreetMap tiles from specific origins
   (`AddressPicker.tsx`), and a CSP strict enough to matter has to
   enumerate those correctly or it silently breaks the address picker;
   that needs deliberate building and testing, not a guessed default.

## Update — removed the Season model, per explicit request

The `Season` model (a year + a flat/per-holiday price, sitting above
`Event`) is gone. Pricing now lives directly on `Event.priceCents`, and
`Category` (added in the design-system/tables pass) gained an optional
`priceCents` for a flat bundle price — set it and any subset of that
category's events charges that one price; leave it null and each
selected event's own price is summed. `Subscription.categoryId` replaces
`Subscription.seasonId` (nullable — a mixed or uncategorized selection
just leaves it null; no unique constraint needed since Postgres treats
multiple NULLs as distinct).

Migration `20260806140000_remove_seasons` backfills every existing
`Event.priceCents` from its old `Season.priceCents` before dropping the
table, so already-generated flag events keep their price. Existing
`Subscription` rows keep their already-computed `amountCents` unchanged;
only the grouping FK moved (to `categoryId`, left `null` for them since
no `Category` existed yet when they were created).

The signup page (`/signup`) now shows every currently-OPEN event
org-wide (via `openEventsForSignup`) instead of "the current year's
Season", computing the bundle-aware total client-side in
`SignupFlow.tsx`. The season-generator action (`generateFlagEvents`,
renamed from `generateFlagSeason`) now creates a `Category` for the year
instead of a `Season` and assigns each of the 7 holiday events to it.
The Settings page's dedicated "Seasons" table is gone — price is edited
directly on each event (`/admin/events`) or bundle (`/admin/categories`).

## Update — categorized top nav, recurring events + calendar picker, start of Phase 6

Nav: the topbar's two hardcoded links (Admin, My routes) became a real
categorized nav bar (`TopNavMenu`) — Browse / My work / Admin dropdowns,
built server-side in `AppTopbar.tsx` from the same capability checks
(`can()`, `route.viewAssigned`, `users.manageRoles`) the rest of the app
already uses, filtered down before ever reaching the client. A signed-out
visitor or a bare Previewer still gets a real (shorter) nav bar instead
of a special-cased empty state.

Event creator: added a template (name/kind/price) driving both a
"Repeats" generator (weekly/biweekly/monthly/yearly × count,
`generateRecurringDates` in `src/lib/recurrence.ts`, pure and unit
tested) and a calendar date-picker — moved into a modal on request
("Open calendar picker") with a short explanation, rather than sitting
inline and taking up space unused. Also added real `.dialog*` CSS to
`packages/ui/src/components.css` — `DataTable`'s three existing modals
referenced those class names with no CSS ever defined for them, so they
were rendering unstyled; now all four modals share one style.

Also fixed two real bugs a self-review turned up in the Season-removal
commit: editing only a category's bundle price silently no-opped
(blocked by an unrelated empty-name check in `renameCategory`), and the
nullable-composite-key workaround for `Subscription` had a real
concurrency race (two rapid requests for the same household+category
could each create one) — closed with a Postgres partial unique index
(`WHERE categoryId IS NOT NULL`) plus a shared `findOrCreateSubscription`
helper that creates-then-catches-P2002 instead of check-then-create.

**Started Phase 6** (SPEC.md §21), the two pieces buildable without a
map component or the UGRC credentials the rest of the phase needs
(territory drawing/fill — still deferred, flagged in
`OPEN-QUESTIONS.md`):
- Paired event creation: `Event.pairedEventId` existed in the schema
  since Phase 0 but was never used. `createPairedEvent` creates the
  FLAG_SETOUT↔FLAG_PICKUP counterpart as a DRAFT one day later, links
  both events, and clones every `Stop` onto it fresh (UNASSIGNED, no
  route — "empty routes" per spec) with `carriedFromStopId` (also
  existed, unused) pointing back at its source. A "Create pickup/
  set-out event" button on the event's Settings tab.
- "Import from last year": clones every event in an existing category
  into a brand-new category shifted forward by N years (dates, and the
  year inside the name if present) — same kind/price/module JSON as the
  source (not recomputed from today's defaults, so per-event
  customization survives), all DRAFT for review.

Territory drawing/fill, the rest of Phase 6, still needs an actual map
component (nothing in this app renders a real map yet — the Phase 3
route builder ended up table-based, not the visual lasso-select the spec
describes) and, for the fill step specifically, a UGRC developer key
this environment doesn't have. Flagging both as real scope, not
oversights, before picking this back up.

## Update — real Google Maps lasso-select for the route builder

Closed the map gap flagged above, at least for Phase 3's route builder
(not yet Phase 6's territory drawing/fill, which still needs the UGRC
key). The event's Routes tab now shows an actual Google Map
(`StopMap.tsx`) with every stop as a pin (gray = unassigned, route
color = already on a route).

`google.maps.drawing.DrawingManager` — the obvious choice for a lasso
tool — turned out to be deprecated as of Maps JS API 3.65 with an empty
class body in `@types/google.maps` (no constructor, no methods), caught
by real TS errors rather than assumed. Built the lasso by hand instead:
click-to-place-a-vertex, a live `Polygon` for the in-progress shape,
"Finish shape" running `geometry.poly.containsLocation` per stop
against the closed polygon. Selecting stops offers "create a new route
from this selection" (2-opt-ordered) or "add to an existing route" —
`createRouteFromStops`/`assignStopsToRoute` in
`packages/database/src/scoped/routes.ts`, which had zero test coverage
before this (11 new tests).

A self-review before merging caught a real bug: both functions
originally reset every lassoed stop's status to `ASSIGNED`
unconditionally, which would have silently erased a volunteer's
already-recorded `DONE`/`SKIPPED`/`ISSUE` outcome the moment an admin
re-lassoed their area. Fixed before it shipped — only stops still
`UNASSIGNED` get bumped.

## Update — three more shipped since the last entry: category-delete cascade, per-org email From, and Territory (Phase 6)

Catching this doc up on what's landed since the lasso-select update above:

1. **Deleting a category now cascades to its events.** Root-caused a
   live report ("signup shows events that don't exist") by querying
   production directly: an admin had deleted a category, and its events
   stayed live, just silently re-bucketed as "Uncategorized" instead of
   disappearing — the original design's deliberate choice, but not what
   an admin expects "delete" to mean. `deleteCategories` now soft-deletes
   the category and every still-live event in it inside one transaction.
2. **The signup-link email's From address is now org-configurable**
   (`/admin/settings`), stored in `Organization.settings.emailFrom` and
   preferred over the deployment-wide `EMAIL_FROM` env var when set —
   different orgs on one deployment can have different senders.
   `RESEND_API_KEY` stays a single deployment-wide credential.
3. **Started the rest of Phase 6: `Territory` (SPEC.md §5.1, §9.2).**
   New model + `/admin/territories` — draw a polygon on the same
   click-to-vertex Google Map interaction StopMap.tsx's lasso already
   uses, name it, save it. Rename/delete (soft) supported. Territory
   *fill* (importing UGRC address points within the shape) is still not
   built — needs the UGRC developer key this environment doesn't have,
   same blocker noted in OPEN-QUESTIONS.md since Phase 1 — so
   `addressPointCount`/`lastFilledAt` stay null on every saved territory
   for now; the UI says so plainly rather than pretending it's done.
   Also fixed a real `.env.example` bug found while wiring this up: it
   documented `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, but every actual read
   site (`AddressPicker.tsx`, `RoutesTab.tsx`, ...) reads
   `NEXT_PUBLIC_GOOGLE_MAPS_API` (no `_KEY` suffix) — the docs, not the
   code, were wrong.

New capability `territory.manage` (OWNER/ADMIN/COORDINATOR, matching
`route.manage`'s roles) added to the shared PERMISSIONS table; the actual
`/admin/territories` page currently only reaches OWNER/ADMIN, since it
sits under `/admin/*`'s existing OWNER/ADMIN-only layout gate and there's
no Coordinator-facing surface for org-wide territories yet — same shape
as other capabilities already in that table.

16 new tests (5 `organizations.test.ts`, 11 `territories.test.ts`).
`tsc --noEmit` clean in both packages, `next lint` clean, `next build`
clean, full `turbo run test` green (139 database + 18 rounds + 28
core-auth = 185 tests).

## Update — publishing moved from Event to Category, per explicit request

"Open" wasn't actually meaning "published" from the admin's point of
view — an admin had to flip every individual event's status to `OPEN`
by hand for it to show on `/signup`, and there was no single "go live"
action for a whole batch of holidays/events at once. Per explicit
request, publishing is now a **Category**-level action:

- New `Category.publishedAt` (nullable timestamp, additive migration).
  `null` = not visible on signup, regardless of what any of its events'
  own `status` says.
- `openEventsForSignup` now requires **both**: the event's own
  `status === "OPEN"` *and* its category's `publishedAt` is set (and
  the category isn't soft-deleted). An event with no category
  (`categoryId` null) can never appear on signup any more — there's no
  category to publish, so "categorize it" is now a prerequisite for
  going live, not optional. This is a real behavior change from before
  this update, called out here rather than left implicit.
- `publishCategory` (new scoped helper) is the one bulk action: sets
  `publishedAt` and, in the same transaction, bulk-opens every `DRAFT`
  event still in that category (a freshly-created category's events
  default to `DRAFT`, so publishing without this would go live with
  nothing actually open). It only touches `DRAFT` events — one an
  admin already explicitly `CLOSED` or `ARCHIVED` stays that way,
  same "don't clobber an explicit state" rule as the route lasso only
  ever bumping `UNASSIGNED` stops.
- `unpublishCategory` only clears `publishedAt` — deliberately leaves
  every event's own `status` untouched, so a later re-publish doesn't
  need to re-derive which events were meant to be open.
- `/admin/categories` gets a new "Signup status" column
  (Published/Not published) using the same inline select-to-edit UX as
  every other column — `saveCategoryRowAction` now handles `published`
  alongside `name`/`priceCents` in the one patch object DataTable
  always sends (its row editor bundles every editable column's current
  value on every save, not just the one that changed — worth noting
  since it's easy to assume otherwise and split this into a second
  action, which would silently no-op on `published` every time a plain
  rename/price-edit patch arrived without that key).

Volunteer/route functionality (`myRoutesForSession`, the route
builder, visit recording) was already independent of `Event.status`
before this change and needed no updates — a volunteer's assigned
route stays reachable regardless of whether its event's category is
published, same as today.

4 new tests (`publishCategory`/`unpublishCategory` in
`categories.test.ts`), 1 test updated (`openEventsForSignup`'s query
shape). `tsc --noEmit` clean in both packages, `next lint` clean,
`next build` clean, full `turbo run test` green (143 database + 18
rounds + 28 core-auth = 189 tests).
