# Phase 2 — Stops from subscriptions, review queue, self-service

Status: **the unblocked slice of Phase 2, built out of order on purpose.**
SPEC.md's phase order has Phase 1 (Stripe Checkout, webhook, confirmation
email) before Phase 2 — but Stripe needs test keys, and the signup UI
still has two open questions from SPEC.md §22.2 (pricing mode/amount,
the legal entity for the Stripe account) that only the user can answer.
Rather than block on those, Phase 1's payment piece was set aside and
this session went straight to Phase 2, which needed no external
credential or unresolved product decision to build for real.

Scoped and approved via three clarifying questions before starting — see
the conversation, not repeated here — with these outcomes:

1. **Self-service delivery**: no email provider is configured in this
   environment (no `RESEND_API_KEY`), so the self-service link is shown
   directly on the signup confirmation screen (copy-to-clipboard) rather
   than emailed. Wiring in a real confirmation email later is additive —
   nothing here needs to change, just an added send step once Resend is
   configured.
2. **Self-service vs. account-linking**: both mechanisms coexist. A
   signed-in, account-linked household uses its account; anyone else
   (or a household that skipped account creation) uses their per-signup
   token link. No conflict — two doors to the same actions.
3. **Needs-review trigger**: stricter than SPEC.md's literal "confidence
   < 0.7" (neither address picker returns a real confidence score) —
   only a **Google**-picked address skips review. Both the free OSM
   picker and manual entry always land in the queue.

## What was built

### Schema (migration `household_review_and_token_expiry`, purely additive)

Two new `Household` columns: `needsReviewReason String?` (so the review
queue is actionable, not just a boolean flag) and
`selfServiceTokenExpiresAt DateTime?` (SPEC.md §4.4's 400-day expiry —
the `selfServiceTokenHash` column already existed from Phase 1 but had
no expiry to check against). No changes to `Stop`, `StopSource`, or
`SubscriptionEvent` — those already had everything Phase 2 needed
(`Stop.householdId`, `SubscriptionEvent.stopId`) from the original
schema.

### `generateStopsFromSubscriptions` (`packages/database/src/scoped/stops.ts`)

SPEC.md §8's "Generate stops from subscriptions." Idempotent two ways:
a `SubscriptionEvent` that already has a `stopId` is skipped, and even
if a prior run created the `Stop` but failed before linking it back
(matched by `(eventId, householdId, source: SUBSCRIPTION)`), re-running
finds and links the existing row instead of creating a duplicate.
Households still `needsReview`, or with no `lat`/`lng` at all (a manual
entry with a typed-but-ungeocoded address), are skipped — the whole
point of the review queue is that a bad address never quietly becomes a
stop a volunteer gets sent to. Wired into the event detail admin page
as a "Generate stops" card, staff-only (`requireRole` with `eventId`,
so a Coordinator scoped to just this event can run it).

### Duplicate detection (`findNearbyHouseholds`, `households.ts`)

SPEC.md §8: "compare within 25m using `ST_DWithin`... surface likely
duplicates as a review card rather than auto-merging." PostGIS is
enabled (`extensions = [postgis]`, from Phase 0) but `Household` stores
plain `lat`/`lng` floats rather than a `geography` column, so the
points are cast to `geography` on the fly in a raw `ST_DWithin` query
rather than needing another schema change. Runs at signup submission
(flagging the *new* household) and again on a self-service address
change (flagging the *existing* one) — both paths call the same
function. Never auto-merges, matching SPEC.md's explicit warning that
auto-merge on address strings eventually merges two units of a duplex.

### Review queue (`/admin/review`, new admin tab)

Lists every `needsReview` household in the org with its reason, oldest
first. "Edit" opens the existing household edit page
(`/admin/library/[householdId]`); saving that form now always clears
`needsReview` — an admin editing the record *is* the review, so no
separate "mark reviewed" step is needed on top of a save that already
changed the thing that needed checking. A standalone "Mark reviewed"
button also exists for the case where the address was actually fine
and nothing needed changing.

### Household self-service (`/h/[token]`, new public route)

SPEC.md §4.4, minus the parts that need an unresolved decision
(mid-season top-up billing needs Stripe; not attempted). Token
authorization lives entirely in `packages/database/src/scoped/
selfService.ts` — every function re-derives the token's hash and looks
up the household by it, rather than trusting a caller-supplied
household id, so possession of the raw token is the only thing that
grants access (scoped to `orgId` too, so a token can't be probed
against a different org's data even by coincidence). Covers:

- View upcoming holidays and each one's date/skip status.
- Skip or un-skip one holiday without cancelling (`SubscriptionEvent.skipped`).
- Edit placement note / access notes.
- Change the address — re-runs `findNearbyHouseholds`, always sets
  `needsReview` (SPEC.md: "flags the household for admin review rather
  than silently moving a pin on a route that may already be assigned" —
  there's no Route model with published state to check yet since that's
  Phase 3, so today `needsReview` is the whole safety mechanism, and
  will keep being checked once routes exist).
- Cancel the subscription (`Subscription.cancelledAt`).

Not built: **renewal** (§4.3 — a whole separate campaign/email flow,
its own phase-sized feature) and the **mid-season top-up Checkout**
when adding a holiday back (needs Stripe). The self-service page's
holiday list is add-mode-free for that reason — skip/un-skip only,
since un-skipping doesn't need a new charge, but adding a holiday not
in the original signup would.

### Signup confirmation screen

Now shows the self-service link in a copy-to-clipboard box, alongside
the existing (Phase-1) "create an account" CTA — both are offered,
matching the "keep both" decision above.

### `AddressPicker`/`GoogleAddressPicker`/`OSMAddressPicker` moved

From `app/(public)/signup/` to `src/components/address/` — the
self-service address-change flow needed the same picker signup uses,
and duplicating it would have meant two copies of the Google-vs-OSM
fallback logic to keep in sync. Pure relocation, no behavior change;
`SignupFlow.tsx`'s import path is the only thing that changed at the
call site.

## Test coverage

Extended the existing scoped-helper test suite (mocked Prisma, no live
DB — see PHASE-1.md's earlier updates for why): `generateStopsFromSubscriptions`'s
idempotency (both the simple case and the "Stop exists but SubscriptionEvent
was never linked" recovery case) and its needs-review skip, plus
role-gating and org-scoping for `householdsNeedingReview`,
`markHouseholdReviewed`, and `findNearbyHouseholds`. Not covered:
`selfService.ts`'s token-based functions — they're not session-role-gated
the way everything else in the suite is (authorization is token
possession, not a role), and mocking the crypto hash flow meaningfully
would need a different test shape than the rest of the suite. Flagged
here rather than silently skipped.

## Verified

`npm run check:copy`, `npm run db:generate`, `npx turbo run test` (43
tests in `packages/database`, all passing), `npm run build --workspace=apps/rounds`,
`eslint`, `tsc --noEmit` — all clean. No live browser testing (no
browser access in this environment) and no live-database testing (only
outbound HTTPS reachable here) — the migration is written and additive
but **needs to be run manually** against the real database, same as
every other migration this session produced.

## Next

Phase 3 (routes) is the next unblocked chunk — lasso/filter selection,
auto-split, 2-opt ordering, assignment — none of it needs Stripe or a
pricing decision either. Phase 1's Stripe piece and Phase 2's renewal
campaign both stay on the backburner until pricing, the legal entity,
and Stripe test keys are available (`docs/rounds/OPEN-QUESTIONS.md`).

## Update — topbar consistency + signup duplication fix

Direct user report: signup's topbar had no padding and looked
inconsistent with the rest of the app, and the desktop layout was
showing duplicate information.

Root causes, both real bugs:

- **Topbar padding/width**: `.rounds-topbar`'s horizontal padding came
  entirely from whatever shell it happened to be nested inside —
  `.rounds-shell` (720px), `.admin-shell` (1180px), or, on `/signup`,
  nothing at all, since `AppTopbar` sat outside any shell there. That's
  why it looked broken specifically on signup and subtly different width
  everywhere else. Fixed by making `.rounds-topbar` itself a full-bleed
  bar with its own fixed padding, a bottom border, and a background —
  and moving `<AppTopbar>` to render *before* each page's shell (as a
  sibling, not a child) on every page: home, welcome, admin, register,
  signup, self-service. Same component, same markup, now genuinely
  pixel-identical everywhere instead of inheriting five different
  parent widths.
- **Duplicate content**: the signup page's desktop layout (added
  last session) put a side panel next to the stepper repeating the
  exact season name, holiday list, and prices that step one of the
  stepper itself already shows — plus the stepper's own header row
  displayed the org's brand mark/name a second time, right below the
  now-present `AppTopbar` doing the same thing. Removed both: the side
  panel is gone entirely, and the stepper's inline brand row is gone
  (the topbar is the one place brand shows now). `SignupFlow`'s now-
  unused `orgName` prop was removed too.

**"Full advantage of the screen"**: rather than filling extra width
with a second copy of the holiday list, the stepper card itself widened
(480px → 640px, was needlessly narrow before) and fills the viewport
edge-to-edge on a phone, centered with breathing room on anything
wider — using the space without inventing content to fill it with.
