# Rounds — Service Projects Routing Platform

**A build specification and Claude Code prompt.** A new app inside the existing `thatguy-bridger/Service-Projects` monorepo, deploying to its own subdomain.

Working name *Rounds*; the app directory is `apps/rounds`. Rename in one place — `apps/rounds/src/config/brand.ts`.

This document is written to be dropped into the repo as `SPEC.md` and worked through by Claude Code section by section. Section 1 is the prompt you paste; everything after it is the reference the prompt points at.

---

## 0. How to use this document

1. On a branch off `claude/repo-file-structure-s5g9ro`, save this file as `SPEC.md` at the repo root.
2. Open Claude Code in that directory.
3. Paste the master prompt in §1.
4. Work phase by phase (§21). Do not let it attempt the whole thing in one pass — the form builder, the route builder, and the layout-block system are each a multi-session project.

**What this app is.** One Next.js app that runs several kinds of door-to-door service event off one spine: routes, stops, volunteers. The first kind that has to work is **flag set-out** — an annual subscription where a household picks which holidays it wants a flag on, pays through Stripe, and volunteers place flags on the morning of each holiday.

**Everything below is decided.** Ten questions were answered across five rounds. §22 records what is locked and the three things still genuinely open.

---

## 1. Master prompt

> Copy everything in this block into Claude Code.

```
You are adding a new app, "Rounds", to the existing Service-Projects
monorepo. Read SPEC.md in this repository in full before writing any
code. It is the source of truth; where this prompt and SPEC.md
disagree, SPEC.md wins.

WHAT IT IS
One Next.js app at apps/rounds that runs door-to-door service events
for a volunteer organisation in Salt Lake County, Utah. An event has a
kind — flag set-out, flag pickup, flyer delivery, fundraiser, or
food-bank pickup — and the kind decides which modules turn on. The
spine is identical for all of them: addresses become stops, stops get
grouped into routes, routes get assigned to volunteers, volunteers
follow them on a phone and record what happened.

The first kind that must work end to end is FLAG_SETOUT. Households
buy an annual subscription through Stripe Checkout and choose which
holidays they want. Each holiday is its own event, and its stops are
generated from the subscriptions that opted into it.

Five roles: Owner, Admin, Coordinator, Volunteer, Previewer. Previewer
is the default state of any new account — they can browse events and do
nothing else until they redeem an invite key an admin issued, which
promotes them and starts a role-specific onboarding tour.

CONSTRAINTS THAT ARE NOT NEGOTIABLE
- This is a monorepo. Reuse packages/core-auth, packages/database,
  packages/ui. Extend them; do not fork them. Anything a second app
  could ever want goes in packages/*, not apps/rounds.
- The design language is docs/design-language.md and the tokens in
  packages/ui/src/tokens.css. Inter, accent #6f4ef0, warm grays,
  generous rounding, soft shadows. Never write a raw hex or px value
  in app code — import the token. If you need a value that isn't
  there, add it to tokens.css first.
- Prisma has no row-level security. Every read of stop, signup, or
  household data goes through a scoped query helper in
  packages/database that takes a session and filters by role. A raw
  prisma.stop.findMany() in app code is a bug. See SPEC.md §6.
- Never hard-code a user-facing string in a component. Every string
  goes through the copy registry in SPEC.md §11 as t('dotted.key').
  Adding a string means adding a default in the same commit.
- Geocoding and territory fill use Utah UGRC, not Mapbox or Google.
  See SPEC.md §9. Verify the current endpoint shapes against
  gis.utah.gov before you build against them; do not trust my
  parameter names.
- Volunteer screens are designed at 390x844 first. Admin screens are
  designed at 1440 first. Both must work on both.

HOW TO WORK
- Build in the phases in SPEC.md §21. At the start of each phase,
  restate its acceptance criteria in your own words and list the files
  you intend to create or change. Wait for my go-ahead.
- Write the Prisma migration and the scoped query helpers in the same
  commit as the feature that needs them.
- Do not add a dependency without telling me its bundle cost and why
  nothing already in the repo will do.
- After each phase write docs/rounds/PHASE-N.md: what was built, what
  was stubbed, what you decided on your own.

FIRST TASK
Read SPEC.md. Then produce, without writing application code:
  a) the file-by-file structure for apps/rounds Phase 0 and Phase 1,
     plus every change needed in packages/*,
  b) the complete Prisma schema diff for Phase 0 and Phase 1,
     including the Role enum migration from ADMIN|USER to five roles
     without dropping existing rows,
  c) the signature of every scoped query helper you intend to add to
     packages/database,
  d) a list of every assumption in SPEC.md you think is wrong or
     risky, with what you would do instead.
Stop there and wait.
```

---

## 2. What we are building

### 2.1 Event kinds and the module matrix

One `Event` model, one `kind` field. The kind is a preset that flips modules on. An admin can override any module on any event; the kind just sets the sensible default.

| Module | `FLAG_SETOUT` | `FLAG_PICKUP` | `FLYER_DELIVERY` | `FUNDRAISER` | `PICKUP_COLLECTION` |
|---|:--:|:--:|:--:|:--:|:--:|
| Public signup form | ✓ | — | — | ✓ | — |
| Subscription-sourced stops | ✓ | ✓ | — | — | — |
| Territory fill / CSV stops | — | — | ✓ | ✓ | ✓ |
| Stripe payment | ✓ | — | — | opt | — |
| Household self-service page | ✓ | ✓ | — | — | — |
| Placement notes on stop | ✓ | ✓ | — | — | — |
| Expects someone to answer | — | — | — | ✓ | ✓ |
| Photo on visit | — | — | — | — | opt |
| Item count on visit | — | — | — | — | ✓ |
| Amount collected on visit | — | — | — | ✓ | — |
| Paired event | ✓ → pickup | ✓ ← set-out | — | — | — |

The volunteer's per-door action differs by kind, so the **visit outcome set is defined per kind**, not globally:

```
FLAG_SETOUT       placed · could_not_place · skipped_by_request
FLAG_PICKUP       collected · not_found · left_in_place
FLYER_DELIVERY    delivered · no_access · refused
FUNDRAISER        donated · pledged · not_home · declined
PICKUP_COLLECTION collected · nothing_out · not_home
```

Every outcome is one of three dispositions — `SUCCESS`, `NEUTRAL`, `FAILED` — so progress bars and dashboards work across kinds without special-casing.

### 2.2 The core loop, flag edition

```
Household visits the public page ──► picks holidays ──► Stripe Checkout
      ↓ webhook confirms payment
Subscription (season 2027) with 3 selected holidays
      ↓ address geocoded against UGRC
Admin opens the Memorial Day event ──► "Generate stops from subscriptions"
      ↓
Stops appear on the map, each carrying its placement note
      ↓
Coordinator lassos a neighbourhood ──► auto-split into 6 balanced routes
      ↓ drag to fix the two that look wrong
Assign to volunteers ──► publish ──► notification
      ↓
Saturday 6am: volunteer opens the route, taps Start, downloads for offline
      ↓
Per stop: read the placement note ──► Navigate hands off to phone maps
      ↓ ──► Placed  (or Couldn't place, and why)
Live board fills in for the coordinator watching from home
      ↓
Event closes ──► create the paired FLAG_PICKUP event, stops clone across
```

### 2.3 Vocabulary

| Term | Definition |
|---|---|
| **Household** | An address plus a contact. Persistent across years and events. Not an account. |
| **Subscription** | One household's annual purchase for one season, with the holidays it selected. |
| **Event** | One dated occasion of one kind. "Memorial Day 2027 — Flag Set-Out". |
| **Signup** | A submission to an event's public form, for kinds that have one. |
| **Stop** | One address on the map for one event, from any of six sources. |
| **Route** | An ordered list of stops assigned to one or more volunteers. |
| **Visit** | What happened at a stop: an outcome, a time, a note. |
| **Key** | A redeemable code that grants a role, optionally scoped to one event. |
| **Territory** | A saved polygon, reusable across events. |

**Note on "customer".** You called this role *customer*. In the code it is `Household`, and the displayed noun is a per-organisation setting (`terminology.household`) with presets: Household · Neighbor · Resident · Subscriber · Participant. Flyer delivery and food-bank pickup have no household-facing side at all, which is exactly why the noun must not be baked into shared components.

### 2.4 Non-goals for v1

In-app turn-by-turn navigation. Native apps. Card payments at the door. Volunteer hour tracking for tax purposes. Chat. Recurring Stripe subscriptions (see §10 — this is deliberately a one-time annual charge). Anything outside Utah.

---

## 3. Roles and access

### 3.1 The ladder

The existing `Role` enum is `ADMIN | USER`. It becomes five values. Write the migration so existing `ADMIN` rows become `ADMIN` and existing `USER` rows become `PREVIEWER` — the safe direction, because a `USER` in the old schema has no route assignments and should not silently gain field access.

| Role | Can do | Cannot do |
|---|---|---|
| **OWNER** | Everything. Billing, Stripe keys, deleting the org, issuing Admin keys. | — |
| **ADMIN** | Create/edit/close events, build forms, review signups and subscriptions, build and assign routes, edit copy, branding and layout blocks, issue Coordinator/Volunteer keys, export, refund. | Delete the org; issue Admin keys. |
| **COORDINATOR** | Review stops, build and assign routes, watch the live board, for events they are attached to. | Edit forms, copy, branding or layout. Issue keys. Export PII. Touch payments. |
| **VOLUNTEER** | See their own assigned routes and only the fields marked visible to volunteers. Record visits. Add a house they find in the field. | See unassigned stops. See the signup or subscription queue. See contact details unless explicitly exposed. |
| **PREVIEWER** | Browse public events. Redeem a key. | Everything else. |

**Coordinator is an addition to your brief.** The person drawing routes every week should not also be able to rewrite the app's wording or export every address in Sandy. One enum value buys that separation.

### 3.2 Sign-in

NextAuth v4 is already in the repo. Four ways in, three of them for staff and volunteers:

- **Google** — `GoogleProvider`. The default and the one to promote.
- **Email magic link** — `EmailProvider`, Resend as the transport.
- **Phone / SMS code** — a `CredentialsProvider` wired to Twilio Verify. NextAuth has no first-party phone provider, so this is custom: send code, store a short-lived challenge, verify, resolve or create the user. Budget real time for it and treat it as Phase 5, not Phase 0. Many volunteers will not have a Google account and will not check email on a Saturday morning; this is worth building, just not first.
- **No account at all** — households never sign in. The public form is anonymous; the self-service page is a signed link (§4.4).

### 3.3 Invite keys

- Format `ABCD-2FGH`: 8 characters, Crockford base32 (no `I`, `L`, `O`, `U`), one dash. Case-insensitive entry, uppercase display, never sequential.
- Fields: `grantsRole`, optional `eventId` scope, `maxUses`, `expiresAt`, `note`, `createdBy`, `revokedAt`.
- An event-scoped key grants the role **for that event only** — the whole reason keys beat generic invites. Hand a volunteer a code that dies when Memorial Day is over.
- Redemption is idempotent per user and **additive**: a person can be a Volunteer on one event and a Coordinator on another. It adds a `Membership` row, never replaces one.
- An admin cannot issue a key above their own role.
- Store the code hashed; keep a display prefix for the list view. Rate-limit redemption to 5/account/hour and 20/IP/hour, with deliberately vague failure messages.
- Every issue and redemption writes an `AuditLog` row.
- Share sheet per key: the code in 32px type, a QR code, a deep link `/join?k=ABCD2FGH` that pre-fills the field, and a printable slip. Nobody should have to type on a phone.

### 3.4 Onboarding after redemption

A real tour, anchored to live elements on real screens — not a modal carousel.

- 3–6 steps per role. Each step: a short title, one sentence, and where possible an action that advances it when actually performed.
- Progress persists per user per role. Closing and returning resumes.
- Always skippable, always re-openable from `Help → Show me around again`.
- Every string lives in the copy registry, so an admin can rewrite the volunteer tour for their own event.
- Ends on a **capability card** — a plain list of what this role can and cannot do — which stays permanently under the account menu. This is the honest answer to "show them their abilities": not a thing seen once.
- Generate the capability card from the permission matrix in `packages/core-auth/permissions.ts` so it can never drift from what the code actually allows.

Tour content per role is in §14.6.

---

## 4. The flag subscription model

This is the part that most changes the shape of the app, so it gets its own section.

### 4.1 Why a subscription is not a signup

A household signs up **once per season** and chooses **which holidays** it wants. Six holidays off one form submission. So a signup cannot belong to an event, and stops cannot be created at submission time — they are generated per event, later, from whoever opted in.

```
Household ──1:N──► Subscription (one per season year)
                        │
                        └──N──► SubscriptionEvent (one per chosen holiday)
                                      │  skipped: boolean
                                      └──► generates a Stop when the admin
                                           runs "generate stops" on that event
```

`SubscriptionEvent` is the join, and it is where `skipped` lives — a household skipping the Fourth of July without cancelling is a flag on the join row, not a deleted record. Keep the row so next year's rollover still sees the intent.

### 4.2 Seasons and holidays

- A `Season` is a year plus the set of events offered in it. Creating a season clones last year's event list with the dates advanced, for the admin to correct.
- Holidays offered for flags in Utah, as the default season: Presidents Day · Memorial Day · Flag Day · Independence Day · Pioneer Day (24 July — Utah-specific and locally the biggest one) · Labor Day · Veterans Day.
- The public page shows the season's holidays as checkboxes with dates, a running price, and the address form.

### 4.3 Renewal

You chose: **email each household in January asking them to confirm and pick holidays.** So:

- A `RenewalCampaign` per season. The admin picks a send date and reviews the copy.
- Each household gets a signed link to a pre-filled form — last year's holidays already checked, last year's address and placement note already filled. Confirm, adjust, pay.
- The admin screen tracks: sent, opened, renewed, lapsed, bounced. Lapsed households stay visible for a manual follow-up call, which is how these programs actually get renewed.
- No auto-charging. Nothing bills a card without a fresh Checkout.

### 4.4 Household self-service

A signed link in every confirmation email, no login. `/h/<token>` where the token is scoped to one household, expires in 400 days, and cannot be enumerated. It lets them:

- See which holidays are coming and on what date.
- Change which holidays they want — adding one mid-season triggers a top-up Checkout; removing one shows a plain no-refund note (or a refund request, admin-approved).
- Update the address. This re-geocodes and **flags the household for admin review** rather than silently moving a pin on a route that may already be assigned.
- Add or change the placement note.
- Skip one holiday without cancelling.
- Cancel the subscription.

Every one of those writes an `AuditLog` row with `actor = household:<id>`, and any change to an address or holiday set on an event whose routes are already published raises an admin alert. A household editing their address the night before Memorial Day must not quietly break a volunteer's route.

---

## 5. Data model

Prisma, Postgres. Extends `packages/database/prisma/schema.prisma`. `cuid()` ids to match the existing convention, `DateTime` throughout, soft delete (`deletedAt`) on anything a human could delete by accident.

**Enable PostGIS.** Add it in a migration and use `Unsupported("geography(Point,4326)")` for locations plus raw SQL for the spatial queries. It buys `ST_DWithin` for "stops within 200m", `ST_Contains` for territory fill, and clustering — all of which you need and none of which you want to write by hand against two float columns.

### 5.1 New models

```prisma
enum Role { OWNER ADMIN COORDINATOR VOLUNTEER PREVIEWER }

enum EventKind { FLAG_SETOUT FLAG_PICKUP FLYER_DELIVERY FUNDRAISER PICKUP_COLLECTION }
enum EventStatus { DRAFT OPEN CLOSED ARCHIVED }
enum StopSource { SUBSCRIPTION SURVEY CSV_IMPORT TERRITORY_FILL MANUAL_PIN CARRIED_OVER FIELD_ADDED }
enum StopStatus { UNASSIGNED ASSIGNED IN_PROGRESS DONE SKIPPED ISSUE }
enum Disposition { SUCCESS NEUTRAL FAILED }
enum SubStatus { DRAFT PENDING_PAYMENT ACTIVE LAPSED CANCELLED }

model Organization {
  id String @id @default(cuid())
  name String
  slug String @unique
  branding Json      // logo, accent override, terminology pack
  settings Json      // feature flags, timezone, stripeAccountId
  memberships Membership[]
  events Event[]
  households Household[]
  createdAt DateTime @default(now())
  deletedAt DateTime?
}

model Membership {
  id String @id @default(cuid())
  orgId String
  userId String
  role Role
  eventId String?    // null = org-wide
  grantedBy String?
  grantedViaKeyId String?
  status String @default("active")
  createdAt DateTime @default(now())
  @@unique([orgId, userId, role, eventId])
  @@index([userId])
}

model Season {
  id String @id @default(cuid())
  orgId String
  year Int
  name String        // "2027 Flag Season"
  priceCents Int     // per selected holiday, or flat — see pricingMode
  pricingMode String // "per_holiday" | "flat"
  renewalOpensAt DateTime?
  events Event[]
  subscriptions Subscription[]
  @@unique([orgId, year])
}

model Event {
  id String @id @default(cuid())
  orgId String
  seasonId String?
  kind EventKind
  name String
  slug String
  status EventStatus @default(DRAFT)
  summary String?
  descriptionMd String?
  coverImageUrl String?
  serviceStartsAt DateTime
  serviceEndsAt DateTime
  signupsCloseAt DateTime?
  timezone String @default("America/Denver")
  depotLat Float?  depotLng Float?
  pairedEventId String?          // FLAG_SETOUT <-> FLAG_PICKUP
  modules Json                   // resolved module matrix, see §2.1
  outcomeSet Json                // the kind's outcomes, overridable
  copyOverrides Json?
  layoutBlocks Json?             // see §11.3
  createdBy String
  createdAt DateTime @default(now())
  deletedAt DateTime?
  @@unique([orgId, slug])
}

model Household {
  id String @id @default(cuid())
  orgId String
  contactName String
  contactEmail String?
  contactPhone String?
  addressInput String            // exactly what they typed
  address Json                   // normalised components from UGRC
  lat Float?  lng Float?
  geocodeConfidence Float?
  geocodeSource String?          // "ugrc" | "manual_pin"
  needsReview Boolean @default(false)
  placementNote String?          // "left of the driveway"
  accessNotes String?            // dog, stairs, sprinklers
  language String @default("en")
  subscriptions Subscription[]
  selfServiceTokenHash String?
  createdAt DateTime @default(now())
  deletedAt DateTime?
  @@index([orgId, lat, lng])
}

model Subscription {
  id String @id @default(cuid())
  householdId String
  seasonId String
  status SubStatus @default(DRAFT)
  amountCents Int
  stripeCheckoutSessionId String?
  stripePaymentIntentId String?
  paidAt DateTime?
  renewedFromId String?          // last year's subscription
  cancelledAt DateTime?
  events SubscriptionEvent[]
  createdAt DateTime @default(now())
  @@unique([householdId, seasonId])
}

model SubscriptionEvent {
  id String @id @default(cuid())
  subscriptionId String
  eventId String
  skipped Boolean @default(false)
  skippedReason String?
  stopId String?                 // set when stops are generated
  @@unique([subscriptionId, eventId])
}

model Signup {                   // only for kinds with a public form
  id String @id @default(cuid())
  eventId String
  formVersion Int
  status String                  // new|needs_address|approved|rejected|duplicate|waitlisted
  contactName String
  contactEmail String?
  contactPhone String?
  addressInput String
  address Json?
  lat Float?  lng Float?
  geocodeConfidence Float?
  answers Json
  internalNotes String?
  duplicateOfId String?
  householdId String?            // matched or created on approval
  submittedAt DateTime @default(now())
  reviewedBy String?
  reviewedAt DateTime?
  ipHash String?
}

model FormSchema {
  id String @id @default(cuid())
  eventId String
  version Int
  fields Json                    // see §7.2
  settings Json
  publishedAt DateTime?          // null = draft
  createdBy String
  @@unique([eventId, version])
}

model Territory {
  id String @id @default(cuid())
  orgId String
  name String                    // "White City north of 9800"
  polygon Json                   // GeoJSON
  addressPointCount Int?         // cached from the last fill
  lastFilledAt DateTime?
}

model Stop {
  id String @id @default(cuid())
  eventId String
  source StopSource
  householdId String?
  signupId String?
  carriedFromStopId String?
  routeId String?
  sequence Int?
  status StopStatus @default(UNASSIGNED)
  lat Float  lng Float
  addressLine String
  label String?
  placementNote String?
  accessNotes String?
  priority Int @default(0)
  estimatedMinutes Int @default(4)
  visits Visit[]
  createdAt DateTime @default(now())
  @@index([eventId, routeId, sequence])
}

model Route {
  id String @id @default(cuid())
  eventId String
  name String
  color String
  status String @default("draft")  // draft|published|in_progress|complete
  travelMode String @default("driving")
  startLat Float? startLng Float?
  endLat Float? endLng Float?
  geometry Json?
  plannedDistanceM Int?
  plannedDurationS Int?
  optimisedAt DateTime?
  manualOrder Boolean @default(false)
  briefingMd String?
  stops Stop[]
  assignments RouteAssignment[]
  createdBy String
  createdAt DateTime @default(now())
  deletedAt DateTime?
}

model RouteAssignment {
  id String @id @default(cuid())
  routeId String
  userId String
  role String @default("lead")   // lead|helper
  assignedBy String
  assignedAt DateTime @default(now())
  acceptedAt DateTime?
  @@unique([routeId, userId])
}

model Visit {
  id String @id @default(cuid())
  stopId String
  routeId String
  userId String
  outcome String                 // from the event's outcomeSet
  disposition Disposition
  note String?
  photoUrl String?
  itemCount Int?
  amountCents Int?
  minutesSpent Int?
  recordedAt DateTime
  syncedAt DateTime?
  recordedOffline Boolean @default(false)
  clientId String @unique        // generated on the device — idempotency
}

model VolunteerAvailability {
  id String @id @default(cuid())
  eventId String
  userId String
  window String                  // "morning" | "afternoon" | "all_day"
  note String?
  @@unique([eventId, userId])
}

model InviteKey {
  id String @id @default(cuid())
  orgId String
  eventId String?
  codeHash String @unique
  codePrefix String
  grantsRole Role
  maxUses Int @default(1)
  useCount Int @default(0)
  expiresAt DateTime?
  note String?
  revokedAt DateTime?
  createdBy String
  createdAt DateTime @default(now())
  redemptions KeyRedemption[]
}

model KeyRedemption {
  id String @id @default(cuid())
  keyId String
  userId String
  redeemedAt DateTime @default(now())
  @@unique([keyId, userId])
}

model UiCopy {
  id String @id @default(cuid())
  orgId String
  eventId String?
  locale String @default("en")
  key String
  value String
  updatedBy String
  updatedAt DateTime @updatedAt
  @@unique([orgId, eventId, locale, key])
}

model AuditLog {
  id BigInt @id @default(autoincrement())
  orgId String
  actorId String?                // null for system; "household:<id>" for self-service
  action String
  entity String
  entityId String
  before Json?
  after Json?
  at DateTime @default(now())
  ipHash String?
  @@index([orgId, at])
}

model Notification {
  id String @id @default(cuid())
  orgId String
  userId String?
  toEmail String?
  toPhone String?
  template String
  locale String @default("en")
  payload Json
  status String @default("queued")
  sendAfter DateTime?
  sentAt DateTime?
  error String?
}
```

### 5.2 Existing models

`User` gains the new `Role` enum and a `memberships` relation. Keep `ServiceRecord` and `Interaction` — they belong to `apps/route-assignments` and are not Rounds' business. Do not repurpose them; the temptation to make `ServiceRecord` do double duty here will cost more than the extra tables.

### 5.3 Rules the schema does not express

- **Signups and subscriptions are history.** Admin corrections write to `Stop` and `Household`, never back over `Signup.addressInput`. The first time someone asks why a volunteer went to the wrong house, you will want the original.
- **Form schemas are versioned and immutable once published.** A signup records its version and renders against that version forever.
- **`Visit.clientId` comes from the device.** It is what makes offline sync idempotent.
- **Generating stops is idempotent.** Running "generate stops from subscriptions" twice must not double them — match on `(eventId, householdId)`.
- **Paired events clone stops, not routes.** You chose this. Cloning sets `source = CARRIED_OVER` and `carriedFromStopId`, and leaves `routeId` null so routes get rebuilt from scratch.

---

## 6. Permission enforcement without RLS

Supabase RLS would put this in the database. Prisma does not have that, so enforcement lives in code — which is more fragile and needs to be treated as such.

**The rule:** app code never calls Prisma directly for stop, signup, household, or visit data. It calls a scoped helper in `packages/database/src/scoped/`.

```ts
// packages/database/src/scoped/stops.ts
export async function stopsForSession(session: Session, eventId: string) {
  const m = await resolveMembership(session, eventId);
  if (isStaff(m)) return prisma.stop.findMany({ where: { eventId } });
  if (m?.role === "VOLUNTEER") {
    return prisma.stop.findMany({
      where: { eventId, route: { assignments: { some: { userId: session.user.id } } } },
      select: volunteerStopSelect(eventId),   // field-level redaction
    });
  }
  return [];
}
```

Two things make this trustworthy rather than hopeful:

1. **`volunteerStopSelect(eventId)` is derived from the event's form schema** — only fields marked `visibleTo: ['volunteer']` are selected. Redaction happens in the query, not in React. If a field is hidden by conditional rendering, it is not hidden; it is in the network response.
2. **A test suite that tries to break it.** For every scoped helper, a test asserting that a volunteer session cannot read an unassigned stop, a previewer reads nothing, and a coordinator cannot read another org's data. Add an ESLint rule banning `prisma.stop`, `prisma.signup`, `prisma.household` and `prisma.visit` outside `packages/database/src/scoped/`. The lint rule is what keeps this true in six months.

`requireRole(session, "ADMIN")` already exists in `packages/core-auth`. Extend it to `requireRole(session, roles[], { eventId })` so event-scoped memberships resolve correctly, and generate both the enforcement and the capability card (§3.4) from one matrix in `packages/core-auth/permissions.ts`.

---

## 7. The form builder

Google Forms as the reference, with three things it does not have: address as a first-class geocoded type, per-role answer visibility, and a flag that promotes an answer into something the volunteer sees at the door.

### 7.1 Builder UX

- Desktop: field list left, canvas centre, settings right. Mobile: single column with a bottom sheet. Building a form on a phone should be possible, not pleasant.
- Type picker grouped by purpose: Text · Choice · Date & time · Contact · Location · Layout.
- Drag to reorder **with** `Move up` / `Move down` in every field's menu. Drag-only fails both accessibility and touch.
- Each field card always shows: label, type icon, a required dot, and an eye icon summarising who can see the answer. Visibility is the thing admins get wrong, so it does not live behind a panel.
- Live preview in a phone frame. Autosave to draft with a visible timestamp. Publishing is explicit and shows a diff against the live version.

### 7.2 Field definition

```ts
type FieldType =
  | 'short_text' | 'long_text' | 'email' | 'phone' | 'number'
  | 'select' | 'multiselect' | 'dropdown' | 'yes_no' | 'scale'
  | 'date' | 'time' | 'file'
  | 'address'                        // privileged, see 7.3
  | 'holiday_picker'                 // privileged, FLAG_SETOUT only
  | 'section' | 'note';

interface Field {
  id: string;                        // stable, never reused
  type: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  required: boolean;
  options?: { id: string; label: string }[];
  validation?: { min?: number; max?: number; pattern?: string;
                 maxLength?: number; fileTypes?: string[]; maxFileMb?: number };
  showIf?: { fieldId: string; op: 'eq'|'neq'|'includes'|'gt'|'lt'; value: unknown }[];
  visibleTo: Role[];                 // who can read the ANSWER
  role: 'standard' | 'placement_note' | 'access_note' | 'stop_label'
      | 'priority' | 'internal';
  adminOnly?: boolean;
  i18n?: Record<string, { label: string; help?: string;
                          options?: Record<string, string> }>;
}
```

`role` is the field that matters:

- `placement_note` → `Stop.placementNote`, shown in accent on the volunteer's stop card. "Left of the driveway", "next to the mailbox".
- `access_note` → `Stop.accessNotes`. "Dog in the yard", "sprinklers run at 6", "use the side gate".
- `stop_label` → the stop's title in the volunteer's list.
- `priority` → biases route ordering.
- `internal` → admin-only, never rendered publicly.

### 7.3 The address field

Exactly one per form, undeletable, relabellable. The field the app is built around.

- Autocomplete against UGRC as they type, biased to the org's service area.
- Store the normalised components **and** the raw string.
- Server-side geocode on submit. Confidence below threshold (default 0.7) sets `needs_address` and routes to a review queue rather than dropping a pin in the wrong city.
- Separate unit/apartment line.
- **"Drop a pin instead"** fallback. New builds in Draper will not be in the address points layer yet, and this will get used more than you expect.
- Warn but do not block on an address outside the service area.

### 7.4 The holiday picker

`FLAG_SETOUT` only. Renders the season's events as checkboxes with dates and a running total, writes `SubscriptionEvent` rows, and drives the Stripe line items. Its labels come from the events themselves, not from the form — so an admin who renames "Pioneer Day" renames it everywhere at once.

---

## 8. Where stops come from

You selected all six sources. They share one target — a `Stop` row with a `source` — but they are six separate pieces of UI, so they are spread across phases.

| Source | How | Phase |
|---|---|---|
| `SUBSCRIPTION` | "Generate stops from subscriptions" on a flag event. Idempotent on `(eventId, householdId)`. | 2 |
| `SURVEY` | An approved `Signup` becomes a `Stop`. Review queue with approve / reject / merge duplicate / fix address. | 2 |
| `CSV_IMPORT` | Upload, map columns to fields, preview with a geocode pass, show the failures before committing. Never import silently. | 3 |
| `TERRITORY_FILL` | Draw or pick a `Territory`, query UGRC address points inside the polygon, preview the count, confirm. §9.2. | 6 |
| `MANUAL_PIN` | Click the map, reverse-geocode, edit the address, save. | 3 |
| `CARRIED_OVER` | "Import from Memorial Day 2026" — copies stops, sets `carriedFromStopId`, leaves routes empty. Also how paired flag pickup works. | 4 |
| `FIELD_ADDED` | A volunteer finds a house that should be on the route and adds it. Lands as `needsReview` and is visible to the coordinator immediately. | 7 |

**Duplicate detection** runs on every path: normalise the street line, compare within 25m using `ST_DWithin`, and surface likely duplicates as a review card rather than auto-merging. Auto-merge on address strings will eventually merge two units of a duplex.

---

## 9. Maps and routing

### 9.1 Rendering and geocoding

**MapLibre GL JS** for rendering — open source, no token, no per-load billing. **UGRC** for geocoding.

Utah publishes address point data for all twenty-nine counties, aggregated by the state from the counties themselves, and offers an API that geocodes against that same statewide roads and address-points dataset. Inside Utah this is more accurate than Mapbox or Google, and it is free. Sandy, Draper, White City and Cottonwood Heights are all well covered.

Wrap it behind `packages/geo/src/provider.ts` with a narrow interface — `geocode`, `reverseGeocode`, `autocomplete`, `addressPointsInPolygon`. Two reasons: UGRC is Utah-only, so the day you serve a household in Idaho you need a fallback, and you do not want ArcGIS response shapes in the UI layer.

**Verify the endpoints before building.** UGRC's API needs a free key from their developer portal, and the address points layer is reachable both as an ArcGIS FeatureServer and through Open SGID, their public Postgres mirror. Check the current parameter names and rate limits at `gis.utah.gov` rather than trusting any spec — including this one.

Basemap: UGRC publishes Utah base map tile services, or use OSM raster tiles. Either way, restyle to the design tokens — light warm ground, muted roads, minimal POIs. POI labels are noise on a route map.

### 9.2 Territory fill

The expensive feature you selected, made cheap by living in Utah.

1. Admin draws a polygon or picks a saved `Territory`.
2. Server queries address points within it — `ST_Contains` against a local import, or UGRC's API for a live query.
3. **Preview before commit:** "1,847 address points found in White City north of 9800. 1,203 are single-family. Create stops?" With a map preview and a count by street.
4. Filter out obvious non-residential by address type where the data supports it.
5. Cache the point set on the `Territory` so redrawing the same area next year is instant.

Import the county subset of address points into your own Postgres once and refresh quarterly — the data is updated quarterly by the counties, so quarterly is the right cadence. A live API call per polygon fill is slower, rate-limited, and no fresher.

### 9.3 Route building

The most important admin screen. Full-bleed map, left rail of unassigned stops, right rail of routes.

**Selecting:** lasso / freehand polygon, rectangle, click, shift-click a range in the list, and filter chips (status, priority, source, any select answer, distance from depot) whose whole filtered set can be selected in one action.

**Making routes:**
- `Create route from selection` — name, colour from a fixed 8-colour palette derived from the accent scale.
- `Auto-split` — N stops into K routes, or into routes of a target duration. k-means on projected coordinates seeded from the depot, then order each cluster. Shown as a preview the admin confirms.
- `Optimise order` per route with travel mode, showing before/after distance and duration.
- Drag to reorder in the rail; any manual drag sets `manualOrder = true` and the UI stops silently re-optimising.
- Drag a stop between routes, in the rail or on the map.
- Route briefing note in markdown, shown to the volunteer before they start.
- A **balance bar** per route — duration against target — so an uneven split is visible before it is published.

**Optimisation without Mapbox.** You chose phone handoff for navigation, which means no Mapbox Optimization API. Do it locally in `packages/routing`:

1. Build a distance matrix. Haversine is adequate for dense residential blocks; upgrade to a road matrix from a self-hosted OSRM or OpenRouteService's free tier if the ordering looks wrong in practice.
2. Nearest-neighbour for an initial tour, then **2-opt** until no improvement. For 40–150 stops this runs in milliseconds and gets within a few percent of optimal.
3. Honour `priority > 0` by constraining those stops toward the front.
4. Run it in a server action, not the browser.

This is genuinely fine for neighbourhood work and it costs nothing. Say so in the UI: "Estimated — actual time depends on traffic and how long each door takes."

### 9.4 The volunteer map

Phone first. A map with a bottom sheet at three detents: peek (next stop), half (stop list), full (route detail).

- Numbered pins; current stop in accent, done hollow, skipped crossed.
- Route line beneath the pins, 3px, accent at 60%.
- Live position with a heading cone, a recentre button, and **no auto-follow by default** — it fights with panning ahead to plan.
- **Next-stop card** always visible in peek: number, address, label, placement note, access notes, distance, and two buttons — `Navigate` and the primary outcome for this event kind (`Placed` on a flag event).
- `Navigate` hands off to the phone's own app, and the UI says so.
  - iOS: `maps://?daddr=<lat>,<lng>&dirflg=d`, falling back to a Google Maps universal link.
  - Android / web: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=<mode>`.
  - Optional "send whole route to Maps" for up to ~9 waypoints.
- Recording a visit is **one tap** for the common case. A flag event's outcomes are `placed` / `could_not_place` / `skipped_by_request`, so the card's primary button is `Placed` and the other two live behind a `Something's wrong` secondary. You told me a flag stop is done by tapping done — so make the happy path a single tap and put the note behind the exception.
- A `Stop list` view with no map, same data. Some volunteers will never open the map; do not force it.

---

## 10. Payments

Stripe Checkout at signup. Deliberately **not** Stripe Subscriptions.

**Why not recurring:** you chose to email households in January and have them re-confirm. That is a fresh purchase decision each year, not a recurring charge. Stripe Subscriptions would auto-bill people who have moved, died, or forgotten — and generate disputes a volunteer organisation should not be handling. One-time Checkout per season is correct.

Flow:

1. Household completes the public form. A `Subscription` is created `PENDING_PAYMENT` with its `SubscriptionEvent` rows.
2. Server creates a Checkout Session — one line item per selected holiday if `pricingMode = per_holiday`, otherwise one flat line — with `metadata.subscriptionId`.
3. Redirect to Checkout. Stripe handles cards, wallets, and receipts.
4. **The webhook is the source of truth.** `checkout.session.completed` → `status = ACTIVE`, `paidAt`, store the payment intent. Never trust the success-page redirect; people close the tab.
5. Confirmation email with the self-service link.
6. Abandoned `PENDING_PAYMENT` rows expire after 24 hours, with one reminder email at hour 2.

Also needed:
- **Mid-season top-up** when a household adds a holiday: a second Checkout for the difference, linked to the same subscription.
- **Refunds** are admin-initiated in-app, calling Stripe and writing an audit row. Never automatic.
- **Manual payment** — an admin can mark a household paid by cash or check, with a required note. This will be used more than you expect, and skipping it means the office keeps a parallel spreadsheet.
- **Reconciliation view** — subscriptions by status with totals, matched against Stripe's payouts, so the treasurer has one screen.
- Webhook signature verification, idempotency on Stripe event ids, and a replay log. Test with the Stripe CLI against a local tunnel.
- Keys in Vercel env vars per §deployment doc. Test mode in preview deployments, live only in production.

---

## 11. Softcoding

Three independent layers. Keep them independent — conflating them is what makes these systems unmaintainable.

### 11.1 Copy registry

```
default (in code) → org override → event override → locale → rendered
```

- Dotted keys namespaced by screen: `volunteer.route.empty`, `admin.signups.approveConfirm`, `household.selfService.skipHoliday`, `previewer.keyEntry.help`.
- `t(key, vars?)` with `{{name}}` interpolation and ICU plurals — `{count, plural, one {# stop} other {# stops}}`. Stop counts are everywhere; get plurals right on day one.
- Defaults in `apps/rounds/src/copy/en.ts`, flat. A CI check fails the build on a key with no default.
- The admin editor groups strings **by screen with a thumbnail of that screen**, not as an alphabetical dump. Each row: key, greyed default, current value, reset, and a length warning where the layout constrains it.
- `?copyKeys=1` overlays every rendered string with its key. This is how an admin finds the string they want, and it will save a hundred support messages.
- Validate overrides: no empty strings, length caps, and interpolation variables must survive — rejecting an override that dropped `{{name}}` prevents a whole class of bug.

### 11.2 Configuration and branding

Per organisation: logo, accent override **validated for contrast** (reject under 4.5:1 for text pairings — the tokens already pass, custom ones must too), terminology pack, default timezone, travel mode, `estimatedMinutes`.

Per event: module toggles (§2.1), outcome set, field visibility per role, tour content, cover image.

**Not softcoded, deliberately:** navigation structure, the position of primary actions, the type and spacing scales, the map interaction model. Say this in the admin UI in one line — it prevents the request.

### 11.3 Layout blocks

You picked the deepest tier. It is the feature most likely to let an admin build something unusable, so it is constrained hard: **a fixed set of slots per screen, a fixed set of blocks per slot, reorder and toggle only.** No freeform canvas, no resizing, no nesting.

```ts
interface ScreenLayout {
  screen: 'volunteer_stop_card' | 'volunteer_route' | 'admin_dashboard'
        | 'public_form' | 'event_landing';
  slots: Record<string, BlockInstance[]>;
}
interface BlockInstance { blockId: string; visible: boolean; props?: Json; }
```

| Screen | Slots | Blocks available |
|---|---|---|
| Volunteer stop card | `primary`, `secondary`, `actions` | address, label, placement note, access notes, visible answers, distance, sequence, household name, phone, photo-of-house |
| Volunteer route screen | `peek`, `sheet`, `header` | next-stop card, progress bar, stop list, route briefing, distance summary, offline status, coordinator contact |
| Admin dashboard | `top`, `main`, `side` | needs-review count, subscription funnel, today's routes, live progress, renewal campaign status, recent audit, unassigned stops |
| Public form | `header`, `footer` | cover image, description, dates, price summary, sponsor logos, privacy notice (locked visible) |
| Event landing | `hero`, `body`, `footer` | hero, description, holiday list, price table, signup CTA, sponsor logos, FAQ, map of service area |

Rules that keep it safe:

- Every block declares `required: boolean`. A required block cannot be hidden — the address on a stop card, the privacy notice on a form.
- Blocks are React components in a registry keyed by `blockId`. Unknown ids render nothing and log; a removed block never white-screens a volunteer at 6am.
- Every screen has a **Reset to default** and a **Preview as volunteer** before saving.
- Layouts are per event, inheriting from an org default.
- Editing is drag-to-reorder plus a visibility toggle, with keyboard alternatives.
- **Ship the defaults in Phase 4 as a hard-coded registry, and add the editor in Phase 8.** The registry is the real work; the editor on top is small. Building the editor early means designing the blocks before you know what a volunteer actually needs on the card.

### 11.4 Multi-language

English and Spanish at launch. Salt Lake County has a substantial Spanish-speaking population and a flyer or a flag signup form is exactly the thing that needs it.

- The copy registry is already locale-keyed. Field labels carry `i18n` (§7.2).
- `Household.language` drives which language their emails and self-service page use.
- The public form offers a language switch in the header; volunteer and admin UI follow the account preference.
- No RTL for now, so no logical-property scramble — but write `padding-inline` rather than `padding-left` anyway. It costs nothing today.
- Machine-translate the defaults, then have a human review. Untranslated keys fall back to English rather than showing a key.

---

## 12. Design language

**The app uses the repo's own design language**, defined in `docs/design-language.md` and implemented in `packages/ui`. Friendly and approachable: warm grays, generous rounding, soft shadows, one confident accent. Not the Modernist system this specification document is typeset in — that is for this document only.

### 12.1 Tokens

Every value comes from `packages/ui/src/tokens.css`. Never a raw hex or px in app code.

```
Accent          --color-accent-500   #6f4ef0     (600 hover, 700 text-on-tint)
Page            --surface-page       gray-50     #faf9f8
Raised          --surface-raised     white
Sunken          --surface-sunken     gray-100    #f2f0ee
Border          --border-default     gray-200    #e6e3e0
Text            --text-primary       gray-900    #1c1916
Secondary       --text-secondary     gray-600    #635c56
Status          success #2fa66b · warning #d99a2b · danger #d9502b · info #2f8ed9
Font            --font-sans  Inter        --font-mono  IBM Plex Mono
Scale           xs 12 · sm 14 · base 16 · lg 18 · xl 22 · 2xl 28 · 3xl 36
Radius          sm 6 · md 10 · lg 16 · full
Shadow          sm card · md hover/dropdown · lg modal
Motion          fast 120ms · base 200ms · ease cubic-bezier(0.2,0,0,1)
Focus           --focus-ring  0 0 0 3px accent-200
```

Dark mode already exists in the tokens via `data-theme="dark"` and `prefers-color-scheme`. The volunteer field UI should support it properly — a 6am route in November is dark, and a bright white phone is genuinely unpleasant. Test the map in dark mode; a light basemap under a dark chrome looks broken.

### 12.2 Additions to `packages/ui`

Build these in the shared package, not in `apps/rounds`, since `route-assignments` will want several of them.

| Component | Spec |
|---|---|
| `Button` size prop | Add `size="lg"` — 48px min height, `--text-base`. Every button a volunteer taps outdoors. |
| `BottomSheet` | Three detents, drag handle, `--radius-lg` top corners, `--shadow-lg`, focus trap, `Esc` to collapse. |
| `Input` / `Field` | Label, help text, error, `--radius-md`, sunken fill, focus ring. The form builder needs it more than anything. |
| `Select` / `Combobox` | Accessible listbox. Address autocomplete depends on it. |
| `Checkbox` / `Radio` / `Switch` | Native under the hood, token-styled. |
| `Table` | Sticky header, sortable, row click opens a panel, virtualises past 200 rows. |
| `Dialog` | Radix or a hand-rolled focus trap. `--shadow-lg`, `--radius-lg`. |
| `Toast` | One at a time. Bottom-left desktop, bottom-centre above the sheet on mobile. |
| `Skeleton` | Matches real layout, no shimmer past 2s. |
| `EmptyState` | Icon, one line, one action. |
| `StatusPip` | 8px dot plus a **text label**, always. Never colour alone. |
| `ProgressBar` | 6px, `--radius-full`, accent fill, ink track at 10%. |
| `MapPin` | 28px rounded-square, accent fill, number in white. Done: white fill, accent border. |
| `KeyDisplay` | Code at `--text-2xl` in mono, letter-spaced, sunken fill, copy button, QR. |
| `Stepper` | For the signup flow: holidays → address → pay. |

### 12.3 Density and layout

- Admin: 12-column grid, `--space-6` gutters, max 1440px. Route builder and live board go full-bleed. Table rows 40px.
- Volunteer: single column, `--space-4` page padding, list rows 56px, tap targets 48px, actions in the lower third.
- Cards are `--surface-raised` with a `--border-default` hairline and `--shadow-sm`. Only genuinely floating things get `--shadow-md` or `lg`.
- Status by pip **and** label. Semantic colours are for status only, never decoration.
- Accent is for interactive things and the current stop. Nothing else.

### 12.4 Imagery

No decorative photography — this is a tool, not a brochure. Event cover images and household-supplied photos are the only images. Use `<image-slot>` placeholders wherever real imagery is not yet available rather than inventing SVG illustrations.

---

## 13. UX principles

1. **The field beats the office.** When a volunteer's need conflicts with an admin's convenience, the volunteer wins. They are outside, cold, holding a flag, one-handed.
2. **The happy path is one tap.** A flag stop is `Placed`. Exceptions go behind a secondary. If the common case takes three taps, the route takes an extra twenty minutes.
3. **Show the state, always.** Sync status, geocode confidence, publish state, payment state, key use count, save state. Anything a user could reasonably doubt is visible without asking.
4. **Destructive actions are reversible or confirmed, never both silent.** Undo toast within 10 seconds; typed confirmation for deleting an event or revoking a redeemed key.
5. **Errors say what to do.** "We couldn't find that address. Try adding a ZIP, or drop a pin on the map instead." Never a code.
6. **Every list has four states.** Empty, loading, error, too-many. Specify them when you build the list, not after QA finds them.
7. **Nothing an admin can configure may break a volunteer's morning.** Every softcoded value has a working default and every unknown value falls back silently.

---

## 14. Screen inventory

### 14.1 Public, no account

| Screen | Contents | States |
|---|---|---|
| Event landing | Hero, description, holiday list with dates, price table, signup CTA, service-area map | draft-hidden · open · closed · sold out |
| Flag signup | Stepper: pick holidays → address (autocomplete + pin fallback) → contact + placement note → review → Checkout | idle · validating address · needs review · redirecting · error |
| Stripe Checkout | Hosted by Stripe | — |
| Signup confirmation | What happens next, holiday dates, self-service link, add-to-calendar | paid · pending webhook |
| Household self-service `/h/<token>` | Upcoming holidays, change selection, update address, placement note, skip one, cancel | active · lapsed · cancelled · token expired |
| Survey form (other kinds) | Rendered `FormSchema` | open · closed · at capacity · submitted |
| Renewal form `/renew/<token>` | Pre-filled from last year, confirm and pay | not started · in progress · done · already renewed |
| Sign in | Google · email link · phone code | idle · sent · error |
| Join with a key | Code field pre-filled from `?k=`, shows what it grants before confirming | idle · validating · invalid · expired · used up · success |

### 14.2 Previewer

Event browser (public events as cards) · Event preview (read-only, service area only, no stops, persistent "Have a key?" bar) · Key redemption with a plain explanation of the five roles · Capability card.

### 14.3 Admin

| Screen | Notes |
|---|---|
| Dashboard | Layout-blocked. Needs-review count, subscription funnel, today's routes, live progress, renewal status |
| Seasons | Create a season, clone last year's events, set pricing |
| Events list | Table: name, kind, status, dates, stops, routes, % complete |
| Event → Overview | Funnel, timeline, quick actions, paired-event link |
| Event → Settings | Name, kind, dates, timezone, depot, modules, outcome set, cover |
| Event → Form builder | §7 |
| Event → Stops | Table + map. Six source actions. Bulk approve/tag/delete. Needs-review as a badged saved filter |
| Stop / signup detail | Slide-over. Answers by form version, address with mini-map and confidence, edit, internal notes, audit trail |
| Event → Routes | The route builder, §9.3. Full-bleed |
| Route detail | Stops, assignments, briefing, print sheet, progress |
| Event → Volunteers | Attached volunteers, availability, load, progress, assign/unassign |
| Event → Live | Routes as rows, stops as squares filling with accent. Wall-display mode |
| Event → Layout | The layout-block editor, §11.3 |
| Households | Search, subscription history, payment state, self-service link, merge duplicates |
| Subscriptions | By status, totals, reconciliation against Stripe, manual mark-paid, refund |
| Renewal campaigns | Compose, send, track sent/opened/renewed/lapsed |
| Territories | Draw, name, save, fill preview, address-point counts |
| Org → Keys | Issue, list, share sheet, revoke, use counts |
| Org → People | Members, roles, scopes, suspend |
| Org → Wording | The copy editor, §11.1 |
| Org → Branding | Logo, accent with contrast validation, terminology |
| Org → Audit log | Filterable |
| Exports | CSV/GeoJSON per entity, PII warning, audited |

### 14.4 Coordinator

Admin minus form builder, wording, branding, layout, keys, exports, households, subscriptions, and org people. Stops, Routes, Volunteers and Live are the working screens.

### 14.5 Volunteer

| Screen | Notes |
|---|---|
| My routes | Cards: event, route, date, stop count, progress. Empty state explains they'll be notified |
| Availability | Which windows they can work, per event. Feeds the assign screen |
| Route briefing | Admin's note, counts, distance, map preview, `Download for offline`, `Start route` |
| Route map | §9.4. The screen that matters |
| Stop list | Same route, no map, grouped done / remaining |
| Stop detail | Label, address, placement note, access notes, visible answers, `Navigate`, outcome buttons |
| Record visit | Primary outcome is one tap. Exceptions behind `Something's wrong` |
| Add a house | Volunteer-found address, lands as needs-review |
| Route complete | Placed, couldn't place, skipped, time taken. Thanks. This is the payoff for four hours |
| Offline banner | What's cached, how many visits queued |
| Profile | Name, phone, language, notification prefs, capability card, sign out |

### 14.6 Onboarding tours

**Admin (6):** create an event → build the form and set who sees each answer → share link and QR → review what comes in → draw a route and assign it → issue a key so your coordinator can help.

**Coordinator (4):** here are the stops waiting → lasso a neighbourhood → auto-split and check the balance bars → assign to a volunteer.

**Volunteer (5, on a real route):** this is your route for Saturday → tap a stop to see where the flag goes → `Navigate` opens your phone's maps → tap `Placed` when it's in, or tell us what went wrong → you can work offline; anything you record uploads when you get signal.

**Previewer (3):** these are the events you can see → this is what each role does → enter your key here when someone gives you one.

---

## 15. Permissions matrix

Build this as data in `packages/core-auth/src/permissions.ts` and generate both enforcement and the capability card from it.

| Capability | Owner | Admin | Coord | Vol | Prev |
|---|:--:|:--:|:--:|:--:|:--:|
| Create / edit event | ✓ | ✓ | — | — | — |
| Build / publish form | ✓ | ✓ | — | — | — |
| Generate stops from subscriptions | ✓ | ✓ | ✓ | — | — |
| Import CSV / fill territory | ✓ | ✓ | ✓ | — | — |
| View stops with contact details | ✓ | ✓ | ✓ | — | — |
| Edit a stop's address | ✓ | ✓ | ✓ | — | — |
| Create / edit route | ✓ | ✓ | ✓ | — | — |
| Assign volunteers | ✓ | ✓ | ✓ | — | — |
| View assigned route | ✓ | ✓ | ✓ | ✓ | — |
| View unassigned stops | ✓ | ✓ | ✓ | — | — |
| Record a visit | ✓ | ✓ | ✓ | ✓ | — |
| Add a house in the field | ✓ | ✓ | ✓ | ✓ | — |
| See household contact details | ✓ | ✓ | ✓ | if exposed | — |
| View subscriptions / payments | ✓ | ✓ | — | — | — |
| Refund / mark paid manually | ✓ | ✓ | — | — | — |
| Send a renewal campaign | ✓ | ✓ | — | — | — |
| Edit UI copy | ✓ | ✓ | — | — | — |
| Edit branding | ✓ | ✓ | — | — | — |
| Edit layout blocks | ✓ | ✓ | — | — | — |
| Issue volunteer / coordinator key | ✓ | ✓ | — | — | — |
| Issue admin key | ✓ | — | — | — | — |
| Export data | ✓ | ✓ | — | — | — |
| View audit log | ✓ | ✓ | — | — | — |
| Browse public events · redeem a key | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 16. Responsive and offline

### 16.1 Breakpoints

```
sm   0–599     phone     volunteer primary; admin read-mostly
md   600–1023  tablet    both usable; route builder becomes list-first
lg   1024–1439 laptop    admin primary
xl   1440+     desktop   route builder and live board
```

No horizontal scroll except inside a deliberately scrollable table. Admin tables become stacked cards below `md`. The route builder below `md` is list-first with the map as a toggle — do not pretend lasso works on a phone. Volunteer screens are designed at 390×844 and centre at 720px on a laptop rather than stretching.

### 16.2 Offline

Scope: **the assigned route works offline; nothing else does.** Offline route building is a nightmare and nobody needs it.

- Service worker caches the app shell.
- On `Start route` (or the night-before notification), prefetch the route, its stops with visible fields, the geometry, and a raster tile pack for the route's bounding box at zooms 13–17. Show download progress and size. Warn before starting if it failed.
- Visits write to IndexedDB with a device-generated `clientId`, then queue. The UI treats a queued visit as done.
- On reconnect, flush with idempotent upserts on `clientId`. Never overwrite a `syncedAt` row with an older `recordedAt`.
- Persistent banner: `Offline · 3 visits waiting to upload`, tappable for a plain-language explanation.
- Sync on reconnect, on foreground, and on pull-to-refresh.
- **Two volunteers on one route** need a conflict story: last-write-wins on `Visit`, but show "marked by Dave 6 minutes ago" on a stop someone else already did. If pairs are common, this needs Realtime; if rare, the sync-time surprise is tolerable.

### 16.3 Performance budgets

Route map interactive under 2.5s on a mid-range Android over LTE. App JS under 250KB gzipped excluding MapLibre, which is lazy-loaded. Public signup form under 120KB — least patient audience in the app. Admin tables virtualise past 200 rows. A 2,000-stop event renders clustered, not as 2,000 markers.

Since scale is unknown, **build the seed script first** (§21 Phase 0) and load-test at 100, 1,000 and 5,000 stops at the end of Phase 3. The clustering decision is cheap then and expensive later.

---

## 17. Notifications

| Trigger | To | Channel | Content |
|---|---|---|---|
| Subscription paid | Household | Email | Receipt, holidays, dates, self-service link |
| Payment abandoned (2h) | Household | Email | Resume link |
| Holiday in 3 days | Household | Email / SMS | We'll be by Saturday morning |
| Route published | Volunteers | Email + push | Route, date, stop count, deep link |
| Event tomorrow | Volunteers | Email + push | Summary, download-for-offline prompt |
| Route complete | Coordinator | In-app | |
| Stops need review | Admins | In-app, batched daily | |
| Address changed after routes published | Admins | In-app, immediate | Which route is affected |
| Key redeemed | Issuing admin | In-app | Who, which role |
| Renewal campaign | Households | Email | Pre-filled renewal link |

All templates go through the copy registry and respect `Household.language` or the user's preference. Per-user channel preferences, an org-level quiet-hours window, and an unsubscribe path on every household email — a legal requirement, not a nicety.

---

## 18. Accessibility

WCAG 2.2 AA, and mean it.

- The tokens' gray and accent pairs are chosen to pass; a custom accent must be contrast-checked before it is accepted (§11.2). Accent-on-white at `--color-accent-500` is fine for large text and chrome — use `--color-accent-700` for accent-coloured body copy.
- Everything keyboard reachable, with the existing `--focus-ring` visible and never removed.
- The route builder needs a full keyboard path: **the stop list is the accessible interface to the map.** Every map action has a list equivalent.
- Drag-to-reorder always has `Move up` / `Move down` — in the form builder, the route rail, and the layout editor.
- Map pins get screen-reader labels; the map is `aria-hidden` with the stop list as its accessible sibling.
- Status is never colour alone — `StatusPip` carries a label by construction.
- `prefers-reduced-motion` disables sheet animation, camera flights and progress transitions.
- Real `<label>`, `aria-describedby` for help text, `aria-invalid` plus an error tied by id. Errors summarised at the top with anchor links on submit failure.
- Target size 24×24 minimum, 48px in the field flow.
- Test with VoiceOver on iOS specifically. The volunteer flow is a phone flow.

---

## 19. Architecture in the monorepo

```
apps/rounds/                        new Next.js app → rounds.bridgerjones.com
  src/app/
    (public)/                       landing, signup, confirmation, h/[token], renew/[token]
    (auth)/                         sign-in, join
    (admin)/                        org + event admin
    (field)/                        volunteer
    api/                            stripe webhook, geocode proxy, optimise, sync
  src/blocks/                       layout-block registry (§11.3)
  src/copy/en.ts, es.ts
  src/config/brand.ts

packages/ui/                        EXTEND — §12.2 components
packages/core-auth/                 EXTEND — five roles, requireRole with eventId,
                                    permissions.ts matrix, Google + Email + phone providers
packages/database/                  EXTEND — schema, and src/scoped/* query helpers (§6)
packages/geo/                       NEW — UGRC provider, geocode, territory fill
packages/routing/                   NEW — clustering, 2-opt, distance matrix
packages/config/                    unchanged
```

Deployment follows `docs/deployment.md` exactly: a new Vercel project with root directory `apps/rounds`, `rounds.bridgerjones.com` as a CNAME to `cname.vercel-dns.com` in Namecheap, and `DATABASE_URL` / `NEXTAUTH_SECRET` / `NEXTAUTH_URL` plus the new Stripe, UGRC, Resend and Twilio keys in that project's environment variables.

**Database sharing.** Rounds shares the existing Postgres instance and `User` table with `route-assignments`. That is the point of the monorepo, but it means a Rounds migration can break the other app. Every migration must be additive; never drop or rename a column `route-assignments` reads. The `Role` enum change in Phase 0 is the one exception and needs coordinating — check every `requireRole` call site in `apps/route-assignments` before shipping it.

Server components by default, client components only where interaction demands. Every third-party key server-side; the geocoder and optimiser proxied through `/api` with per-user rate limits.

---

## 20. Security and privacy

This app holds home addresses of people who paid for a service, often elderly, plus notes like "dog in the yard" and "hard of hearing". Treat it accordingly.

- **Minimise by default.** A new field's `visibleTo` is admin-only. Exposing something to volunteers is an active choice.
- **Redaction happens in the query** (§6), never in React.
- Exports audited, rate-limited, and warned before download. Consider watermarking the CSV with the exporter's id.
- Photos to a private bucket with short-lived signed URLs. Strip EXIF including GPS on upload.
- Self-service and renewal tokens: signed, single-household, 400-day expiry, not enumerable, revocable, and rotated when a household changes their email.
- Retention per season: purge household contact details 24 months after the last event they participated in, with an admin-visible countdown. Aggregate stats survive; PII does not. Payment records follow whatever your accountant needs — usually seven years — so store those separately from contact details.
- Hash IPs. Drop user agents after 30 days.
- Analytics never receive addresses, names, emails or coordinates. Configure the denylist explicitly and write a test for it.
- Stripe: webhook signature verification, no card data ever touching your servers, PCI scope stays SAQ-A because Checkout is hosted.
- Rate limits: form submit 5/hour/IP, key redemption per §3.3, geocoding 60/hour/user, self-service token 30/hour.
- A privacy notice on every public form, editable but not blankable.

---

## 21. Build phases

Each phase ends with a demo and `docs/rounds/PHASE-N.md`.

**Phase 0 — Foundation and the role migration.** `apps/rounds` scaffolded from `apps/route-assignments`. `Role` enum migrated to five values without dropping rows, every `requireRole` call site in the other app checked. `permissions.ts` matrix. Scoped query helper pattern plus the ESLint rule banning direct Prisma access. Copy registry with `t()` and the CI check. PostGIS enabled. **A seed script generating realistic Sandy/Draper households and stops at 100, 1,000 and 5,000 scale.** Google + email sign-in. Previewer shell.
*Done when:* a new account signs in with Google, lands as a Previewer, sees a token-styled empty state whose text comes from the registry, and `npm run seed -- --stops 1000` produces a usable dataset.

**Phase 1 — Seasons, events, and the flag signup.** Season and Event models with the kind/module matrix. Flag event creation. The public landing and signup flow: holiday picker → address with UGRC autocomplete and pin fallback → contact and placement note → review. Stripe Checkout, webhook, confirmation email. Household and Subscription models.
*Done when:* a household on a real phone picks three holidays, pays with a Stripe test card, and lands as an `ACTIVE` subscription with three `SubscriptionEvent` rows — and closing the tab mid-Checkout still resolves correctly from the webhook.

**Phase 2 — Stops from subscriptions and the review queue.** "Generate stops from subscriptions", idempotent. Needs-review queue for low-confidence geocodes. Duplicate detection within 25m. Stop and household detail panels. Household self-service page: change holidays, update address with review flagging, placement note, skip, cancel.
*Done when:* 300 seeded subscriptions generate 300 stops with two deliberate bad addresses caught in the queue, and a household changes its address through the self-service link and shows up as needing review.

**Phase 3 — Routes.** The route builder: lasso, filters, create, auto-split with balance bars, 2-opt optimise, drag reorder, colour, briefing. CSV import with a geocode preview. Manual pins. Assignment, publish, print sheet. **Load-test at 100 / 1,000 / 5,000 stops and decide the clustering strategy.**
*Done when:* 400 stops split into 12 balanced routes and assigned, balance bars visibly even, and the 5,000-stop map still pans at 30fps.

**Phase 4 — The field app.** My routes, availability, briefing, map with bottom sheet, stop detail with query-level redaction, navigation handoff, one-tap outcome recording, route complete. The layout-block **registry** with hard-coded defaults for the stop card and route screen — no editor yet.
*Done when:* a volunteer completes a 15-stop flag route outdoors on a real phone with no instruction, and `Placed` is one tap.

**Phase 5 — Keys, previewer, onboarding, phone sign-in.** Key issuing, share sheet with QR, redemption with scoping, revocation, audit. The four tours. The generated capability card. Previewer event browser. Twilio Verify phone sign-in.
*Done when:* a brand-new account scans a QR, redeems a volunteer key, finishes the tour, and completes their first stop without help.

**Phase 6 — Territories, paired events, carry-over.** Territory drawing and saving. UGRC address-point import for Salt Lake County into local Postgres, with a quarterly refresh job. Polygon fill with a confirm-before-commit preview. Paired flag-pickup event creation cloning stops. "Import from last year".
*Done when:* a drawn polygon over White City previews an accurate address count and creates stops, and a Memorial Day pickup event clones its set-out stops with empty routes.

**Phase 7 — Offline, notifications, other event kinds.** Service worker, tile packs, visit queue, sync, offline banner. Email, SMS, push, preferences, quiet hours. Spanish locale. Flyer delivery, fundraiser and food-bank pickup kinds enabled with their outcome sets. Volunteer-added houses.
*Done when:* a route is completed in airplane mode and syncs cleanly including a duplicate submit that does not duplicate — and a flyer event runs end to end with no household side at all.

**Phase 8 — Softcoding editors, renewal, live board.** Copy editor with screen grouping and `?copyKeys=1`. Branding with contrast validation. The layout-block editor over the Phase 4 registry. Renewal campaigns with tracking. Live progress board and wall display. Subscription reconciliation. Exports with audit. Retention job.
*Done when:* an admin retitles every volunteer-facing string, reorders the stop card, and swaps the accent without touching code — and nothing breaks or falls out of contrast.

**Phase 9 — Hardening.** Accessibility audit with VoiceOver. Performance budgets met. The permission test suite that actively tries to break §6. Stripe webhook replay testing. A rehearsal event with real volunteers before the first real holiday.

---

## 22. Decisions locked, and what is still open

### 22.1 Locked

| # | Decision |
|---|---|
| 1 | New app `apps/rounds` in the existing monorepo. One app, `EventKind` switches modules. |
| 2 | The repo's design language wins — Inter, `#6f4ef0`, warm grays, generous rounding. Modernist is for this document only. |
| 3 | Next.js 14, NextAuth v4, Prisma + Postgres, Turborepo, Vercel per subdomain. |
| 4 | No RLS. Scoped query helpers in `packages/database` plus an ESLint ban and a test suite. |
| 5 | Flag set-out ships first, as an annual subscription where the household picks holidays. |
| 6 | Stripe Checkout, one-time per season. Not Stripe Subscriptions. |
| 7 | Renewal by January email with a pre-filled link. No auto-charging. |
| 8 | Flag pickup is a separate paired event; it clones stops, routes get rebuilt. |
| 9 | UGRC for geocoding and territory fill. Utah-only, accepted, behind a swappable provider. |
| 10 | MapLibre for rendering, phone handoff for turn-by-turn, local 2-opt for ordering. |
| 11 | Five roles including a new Coordinator. Invite keys, optionally event-scoped. |
| 12 | Offline covers the assigned route only. |
| 13 | Softcoding = copy + field visibility + branding + constrained layout blocks on five screens. |
| 14 | English and Spanish. |
| 15 | A flag stop is done in one tap; exceptions carry a reason. |

### 22.2 Still open

1. **Do volunteers work in pairs?** If two phones share a route, §16.2 needs Realtime and a "Dave already did this one" state. If they work alone, the simple sync story holds. This changes Phase 4.
2. **Price and pricing mode.** Per holiday or flat for the season, and how much. Needed for Phase 1's Checkout line items, and it affects the signup UI — a running total reads very differently at $5 a holiday than at $60 flat.
3. **Who is the legal entity?** It determines the Stripe account, the privacy notice, the retention defaults, and whether "we collect home addresses of elderly residents" needs anything written down beyond good intentions.

Everything else in this document is a decision you can change cheaply by telling Claude Code to change it before the phase in question.
