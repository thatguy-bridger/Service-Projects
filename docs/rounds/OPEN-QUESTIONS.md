# Open questions for Bridger

Running list, updated as phases land. Nothing here blocks the code that's
already built — everything below was given a documented placeholder or a
deliberately narrow, safe default so work could keep moving. Answering
these unblocks *more* — real Stripe pricing, a real privacy notice, real
sign-in, real geocoding — not a rebuild of what's already there.

## From SPEC.md §22.2 (the spec's own open items)

1. **Pricing and pricing mode.** Per-holiday or flat for the season, and
   how much. You said "not decided — use a placeholder" for now.
   Placeholder used: `Season.pricingMode`/`priceCents` aren't built yet
   (that's Phase 1, the flag signup flow) — when they land they'll use an
   obvious placeholder price flagged in the admin UI, not a guessed real
   number. **Needed before Phase 1's Stripe Checkout can charge anyone
   for real**, and it changes the signup UI (a running total reads very
   differently at $5/holiday than $60 flat).

2. **Legal entity.** Whose name the Stripe account, privacy notice, and
   retention defaults sit under. You said "not decided — use a
   placeholder." Placeholder used: `apps/rounds/src/config/brand.ts` has
   `organizationName: "[ORGANIZATION NAME]"`. **Needed before Phase 1**
   (privacy notice on the public form) **and before any real Stripe
   account is created.**

3. **Volunteer pairs.** You said "yes, sometimes" — two phones can share
   one route. This is bigger than it sounds: SPEC.md §16.2's simple
   "last write wins" offline sync isn't enough once two people are
   working the same stops; it needs a "marked by Dave 6 minutes ago"
   conflict UI and, per the spec, realtime presence. **Not designed yet
   — Phase 4 (the field app) and Phase 7 (offline sync) both need this
   decided before they're built, not stubbed**, because it changes the
   sync architecture, not just a UI detail. Flagging this as the one item
   on this list that's a real design decision, not a "fill in a number."

## UGRC verification (SPEC.md §9.1 asked for this explicitly)

Attempted for real during Phase 1, not skipped: `gis.utah.gov` and
`api.mapserv.utah.gov` (docs pages and the raw OpenAPI JSON) return HTTP
403 to this environment's fetch tool on every path tried — looks like bot
protection. A web search surfaced a real, sourced example URL from a UGRC
blog post confirming the single-address geocode endpoint's shape
(`/api/v1/geocode/{street}/{zone}?spatialReference=4326&apiKey=...` —
path segments, not one query param — and that the match score is
documented 0–100). `packages/geo/src/ugrc.ts`'s `geocode()` is built
against that; its exact response field names are best-effort
(AGRC/ArcGIS convention), not confirmed live. `reverseGeocode`,
`autocomplete`, and `addressPointsInPolygon` are deliberately left
unimplemented (clear thrown errors, not guesses) rather than building
against three more unverified shapes.

**Update: a UGRC key was obtained, and it doesn't work from this
deployment.** A real `UGRC_API_KEY` was added as a GitHub Actions
secret and probed against the live API (temporary `ugrc-probe.yml`
workflow, since removed). Every call — from two different runner IPs,
and after regenerating the key — failed the same way:

```
{"status":400,"message":"Your API key does match the pattern created in
the self service website for key `ugrc-...`. The request is originating
from `<ip>`"}
```

UGRC's self-service portal locks a key to whatever IP/referrer pattern
was active at creation time, with no way found in the portal to edit or
remove that restriction. Vercel doesn't provide a fixed outbound IP by
default, so even a working key would keep failing intermittently in
production — this isn't a one-time setup problem, it's a structural
mismatch between UGRC's key model and how this app is hosted. Real
options if this is revisited: UGRC support may be able to issue an
unrestricted key on request, or a static-IP proxy service (QuotaGuard
Static, Fixie, or a small self-hosted VPS) could give Vercel a fixed
egress IP to register with UGRC. Neither was pursued.

**Territory fill was built anyway, without UGRC**, per SPEC.md §9.2's
own stated preference ("import once into local Postgres, refresh
quarterly... a live API call per polygon fill is slower, rate-limited,
and no fresher" — a live call was never actually the end-state design,
just the fallback if a local import wasn't ready yet). New `AddressPoint`
model + `/admin/address-points`: import any address-point CSV (not
UGRC-specific — OpenAddresses.io's open, no-key dataset works, as would
a county's own open-data export), tagged with a source label; re-
importing a label replaces that batch, which is the refresh mechanism.
`previewTerritoryFill` counts `AddressPoint` rows inside a saved
Territory's polygon via `ST_Contains`, entirely local, no external API
at request time. `packages/geo/src/ugrc.ts`'s `geocode()` stays as the
one verified UGRC integration (real address-field geocoding, a
different use case than bulk territory fill); `reverseGeocode`/
`autocomplete`/`addressPointsInPolygon` remain unimplemented — territory
fill no longer needs the last one at all.

## Credentials this environment doesn't have

Nothing below blocked Phase 0 — every integration point is wired and
guarded to fail closed (missing key ⇒ feature quietly not registered,
not a crash). They block the corresponding phase's *real* functionality:

| Credential | Blocks | Where it plugs in |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Real Google sign-in (the actual OAuth round-trip was never exercised, only the guard logic) | `packages/core-auth/src/authOptions.ts` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Real email magic-link sign-in | same file |
| Stripe test + live keys | Phase 1 Checkout | Phase 1, not built yet |
| UGRC developer key | Real address-field geocoding/autocomplete (reverseGeocode/autocomplete remain unimplemented). **Not** territory fill any more — that's now a local `AddressPoint` import, see the UGRC verification section above. | Phase 1 (address field) |
| Twilio Verify | Phone/SMS sign-in | Phase 5, not built yet |
| `DATABASE_URL` for a real (non-local) Postgres | Deploying anywhere | `docs/deployment.md`'s existing flow (Neon/Supabase) — **must have PostGIS available**; confirm your chosen host supports the extension before picking one |

## Decisions made without waiting for a go-ahead

Listed so they're easy to revisit, not because any of them seem wrong:

- **`resolveMembership` treats OWNER/ADMIN as org-wide**, bypassing a
  per-org Membership check. Correct for a single-organization deployment
  (this app's actual real-world scope), wrong the moment a second org
  shares the database. Flagged in `docs/rounds/PHASE-0.md`.
- **`Stop.needsReview`** added to the schema now (not in SPEC.md §5.1's
  literal model block) because §8's `FIELD_ADDED` row requires it and
  there was no reason to save it for a later migration.
- **The ESLint Prisma-access ban is syntactic, not type-aware** — an
  `import { prisma as db }` rename would evade it. A type-aware version
  is real added scope beyond SPEC.md §6's literal ask.
- **PostGIS enabled via the `postgresqlExtensions` preview feature**
  rather than modeling `lat`/`lng` as `Unsupported("geography(Point,4326)")`
  columns. SPEC.md §5's prose says to use the geography type, but its own
  concrete Prisma model blocks use plain `Float` columns — the literal,
  copy-pasteable schema was followed; spatial queries (§9's `ST_DWithin`
  etc., needed starting Phase 2) will cast `ST_MakePoint(lng, lat)` in
  raw SQL rather than reading a dedicated geography column. Worth a
  second look when Phase 2's duplicate-detection query actually gets
  written.
- **A GitHub Actions CI workflow was added** (`.github/workflows/ci.yml`)
  — none existed before. It runs against a real `postgis/postgis`
  service container. Added because "the CI check" (SPEC.md §11.1) needs
  something to actually run in, but this is new infrastructure you didn't
  explicitly ask for — worth a look in case you already had a different
  CI plan.
- **`eslint` and `eslint-config-next` were added as root devDependencies**
  — neither existed anywhere in the repo before (confirmed via
  `package-lock.json`), so `next lint` silently couldn't run for
  `route-assignments` either, before this branch.

## Branch / process

- Everything landed on `rounds/phase-0-foundation`, branched off
  `claude/repo-file-structure-s5g9ro` per SPEC.md §0's instruction, and
  pushed to `thatguy-bridger/Service-Projects`. Not merged — normal
  review applies.
- Given the go-ahead ("start building Phase 0 now" + "build out as much
  as you can" while away), work continued past the plan-only checkpoint
  SPEC.md's own master prompt describes, straight into building and
  verifying Phase 0, and then as far into later phases as landed cleanly
  in the same session — see `docs/rounds/PHASE-1.md` if one exists by the
  time you read this.
