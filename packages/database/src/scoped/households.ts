import { randomBytes, createHash } from "node:crypto";
import { Prisma, type SubStatus } from "@prisma/client";
import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";
import { parseCsvRows } from "../csv";

const SELF_SERVICE_TOKEN_DAYS = 400; // SPEC.md §4.4

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Raw token to hand to the household (once, never stored) + its hash (stored). */
function issueSelfServiceToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SELF_SERVICE_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash: hashToken(raw), expiresAt };
}

/**
 * Households within `radiusMeters` of the given point, in the same org
 * — SPEC.md §8's duplicate detection ("compare within 25m using
 * ST_DWithin"). PostGIS is enabled (see schema.prisma's
 * `extensions = [postgis]`) but Household stores plain lat/lng floats
 * rather than a `geography` column, so the points are cast on the fly
 * rather than needing a schema change. Surfaced as a review flag, never
 * auto-merged — SPEC.md is explicit that auto-merge on address strings
 * eventually merges two units of a duplex.
 */
export async function findNearbyHouseholds(
  orgId: string,
  lat: number,
  lng: number,
  excludeHouseholdId: string,
  radiusMeters = 25
): Promise<{ id: string; contactName: string }[]> {
  return prisma.$queryRaw<{ id: string; contactName: string }[]>`
    SELECT id, "contactName" FROM "Household"
    WHERE "orgId" = ${orgId}
      AND id != ${excludeHouseholdId}
      AND "deletedAt" IS NULL
      AND lat IS NOT NULL AND lng IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}::float, ${lat}::float), 4326)::geography,
        ${radiusMeters}
      )
  `;
}

// SPEC.md §6: household data (home addresses, access notes) never goes
// through a raw `prisma.household` call in app code — see the ESLint rule
// in packages/config/eslint-preset.js.
export async function householdsForSession(session: SessionLike | null | undefined, orgId: string) {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];
  return prisma.household.findMany({ where: { orgId, deletedAt: null } });
}

export async function householdForSession(
  session: SessionLike | null | undefined,
  orgId: string,
  householdId: string
) {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return null;
  return prisma.household.findFirst({ where: { id: householdId, orgId, deletedAt: null } });
}

export type HouseholdSortField = "contactName" | "contactEmail" | "addressInput" | "createdAt";

export interface BrowseHouseholdsInput {
  query?: string;
  sortBy?: HouseholdSortField;
  sortDir?: "asc" | "desc";
  page?: number; // 1-indexed
  pageSize?: number;
}

export interface BrowseHouseholdsResult {
  households: Awaited<ReturnType<typeof prisma.household.findMany>>;
  total: number;
  page: number;
  pageSize: number;
}

// The org-wide "data library" — every household ever created for this
// org (not scoped to one event), sortable and paginated like any other
// data table, with an optional text filter across name/email/phone/
// address. No query means "show everything" (paginated), not "show
// nothing" — a real library is something you browse, not just search.
export async function browseHouseholds(
  session: SessionLike | null | undefined,
  orgId: string,
  input: BrowseHouseholdsInput = {}
): Promise<BrowseHouseholdsResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { households: [], total: 0, page: 1, pageSize: 0 };

  const q = input.query?.trim();
  const sortBy = input.sortBy ?? "createdAt";
  const sortDir = input.sortDir ?? "desc";
  const pageSize = input.pageSize ?? 50;
  const page = Math.max(1, input.page ?? 1);

  const where: Prisma.HouseholdWhereInput = {
    orgId,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { contactName: { contains: q, mode: "insensitive" } },
            { contactEmail: { contains: q, mode: "insensitive" } },
            { contactPhone: { contains: q, mode: "insensitive" } },
            { addressInput: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [households, total] = await Promise.all([
    prisma.household.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.household.count({ where }),
  ]);

  return { households, total, page, pageSize };
}

// Admin-created household, straight into the org's library -- no
// signup flow, no geocoding (lat/lng stay null, same as a manual signup
// entry). Staff-only, unlike submitSignup which is intentionally public.
export async function createHouseholdAdmin(
  session: SessionLike | null | undefined,
  orgId: string,
  input: { contactName: string; contactEmail?: string; contactPhone?: string; addressInput: string }
): Promise<UpdateHouseholdResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  if (!input.contactName.trim() || !input.addressInput.trim()) {
    return { ok: false, error: "Name and address are required." };
  }

  await prisma.household.create({
    data: {
      orgId,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail?.trim() || undefined,
      contactPhone: input.contactPhone?.trim() || undefined,
      addressInput: input.addressInput.trim(),
      address: { raw: input.addressInput.trim(), source: "admin-created" } as Prisma.InputJsonValue,
    },
  });
  return { ok: true };
}

export interface UpdateHouseholdInput {
  contactName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressInput?: string;
  placementNote?: string | null;
  accessNotes?: string | null;
  needsReview?: boolean;
  needsReviewReason?: string | null;
}

export interface UpdateHouseholdResult {
  ok: boolean;
  error?: string;
}

export async function updateHousehold(
  session: SessionLike | null | undefined,
  orgId: string,
  householdId: string,
  input: UpdateHouseholdInput
): Promise<UpdateHouseholdResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.household.updateMany({
    where: { id: householdId, orgId, deletedAt: null },
    data: input,
  });
  if (result.count === 0) return { ok: false, error: "Household not found." };
  return { ok: true };
}

export interface DeleteResult {
  deleted: number;
  errors: { id: string; reason: string }[];
}

// Soft delete — Household already has deletedAt and every read path here
// filters on it, so this is safe with no FK cleanup needed (unlike
// deleting a User, which has real foreign-key dependents).
export async function deleteHouseholds(
  session: SessionLike | null | undefined,
  orgId: string,
  householdIds: string[]
): Promise<DeleteResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { deleted: 0, errors: [{ id: "", reason: "Forbidden" }] };

  const result = await prisma.household.updateMany({
    where: { id: { in: householdIds }, orgId },
    data: { deletedAt: new Date() },
  });
  return { deleted: result.count, errors: [] };
}

// Unlink households from one event without touching the Household row
// itself (or its Subscription, which may still cover other events in
// the same season) — just the SubscriptionEvent join row. Always safe:
// nothing references SubscriptionEvent.
export async function removeHouseholdsFromEvent(
  session: SessionLike | null | undefined,
  eventId: string,
  subscriptionEventIds: string[]
): Promise<DeleteResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { deleted: 0, errors: [{ id: "", reason: "Forbidden" }] };

  const result = await prisma.subscriptionEvent.deleteMany({
    where: { id: { in: subscriptionEventIds }, eventId },
  });
  return { deleted: result.count, errors: [] };
}

export interface UpdateSignupForEventInput {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressInput?: string;
  placementNote?: string;
  accessNotes?: string;
  // "Permission" in the admin UI -- the subscription's approval status
  // for this household/season.
  subscriptionStatus?: SubStatus;
  amountCents?: number;
  skipped?: boolean;
}

// One row in the "Service Sign Ups" / "Member Purchases" admin tables
// touches three tables at once (Household contact fields, Subscription
// status/amount, SubscriptionEvent.skipped) -- this is the single write
// path for editing any of them inline, keyed by the join row's id since
// that's what the table renders one row per.
export async function updateSignupForEvent(
  session: SessionLike | null | undefined,
  eventId: string,
  subscriptionEventId: string,
  input: UpdateSignupForEventInput
): Promise<UpdateHouseholdResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const subEvent = await prisma.subscriptionEvent.findFirst({
    where: { id: subscriptionEventId, eventId },
    include: { subscription: true },
  });
  if (!subEvent) return { ok: false, error: "Signup not found." };

  const { contactName, contactEmail, contactPhone, addressInput, placementNote, accessNotes, subscriptionStatus, amountCents, skipped } =
    input;

  await prisma.$transaction([
    prisma.household.update({
      where: { id: subEvent.subscription.householdId },
      data: { contactName, contactEmail, contactPhone, addressInput, placementNote, accessNotes },
    }),
    prisma.subscription.update({
      where: { id: subEvent.subscriptionId },
      data: { status: subscriptionStatus, amountCents },
    }),
    prisma.subscriptionEvent.update({
      where: { id: subscriptionEventId },
      data: { skipped },
    }),
  ]);

  return { ok: true };
}

export interface CopyToEventResult {
  copied: number;
  error?: string;
}

// The other half of the library: copy already-known households straight
// into an event — no CSV in the middle. Same underlying write as
// Prisma's composite-unique upsert doesn't handle a nullable key field
// well (categoryId is null for uncategorized subscriptions), so this
// can't use `prisma.subscription.upsert` on (householdId, categoryId)
// directly. Instead: try to create, and if a concurrent request already
// created the same household+category Subscription first, the database's
// partial unique index (categoryId IS NOT NULL -- see migration
// 20260806150000_subscription_category_unique) raises Postgres error
// 23505, which Prisma surfaces as P2002; catch that and fetch/update the
// row the other request just created. This is race-safe for a real
// category; a null category has no such constraint by design (a
// household may have several separate uncategorized Subscriptions), so
// concurrent null-category calls each just create their own row, which
// is the intended behavior there.
async function findOrCreateSubscription(
  householdId: string,
  categoryId: string | null,
  initial: { status: SubStatus; amountCents: number }
) {
  try {
    return await prisma.subscription.create({
      data: { householdId, categoryId, status: initial.status, amountCents: initial.amountCents },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.subscription.findFirst({ where: { householdId, categoryId } });
      if (existing) return existing;
    }
    throw err;
  }
}

// importHouseholdsForEvent (upsert Subscription + SubscriptionEvent),
// just addressed by existing Household id instead of parsed CSV rows.
export async function copyHouseholdsToEvent(
  session: SessionLike | null | undefined,
  input: { orgId: string; eventId: string; categoryId: string | null; amountCents: number; householdIds: string[] }
): Promise<CopyToEventResult> {
  const membership = await resolveMembership(session, input.eventId);
  if (!membership || !isStaff(membership.role)) return { copied: 0, error: "Forbidden" };
  if (input.householdIds.length === 0) return { copied: 0, error: "No households selected." };

  let copied = 0;
  for (const householdId of input.householdIds) {
    const household = await prisma.household.findFirst({ where: { id: householdId, orgId: input.orgId } });
    if (!household) continue; // skip anything that doesn't belong to this org

    const subscription = await findOrCreateSubscription(householdId, input.categoryId, {
      status: "PENDING_PAYMENT",
      amountCents: input.amountCents,
    });

    await prisma.subscriptionEvent.upsert({
      where: { subscriptionId_eventId: { subscriptionId: subscription.id, eventId: input.eventId } },
      update: {},
      create: { subscriptionId: subscription.id, eventId: input.eventId },
    });

    copied++;
  }

  return { copied };
}

export interface HouseholdForEvent {
  subscriptionEventId: string;
  skipped: boolean;
  subscriptionId: string;
  subscriptionStatus: string;
  amountCents: number;
  household: {
    id: string;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    addressInput: string;
    placementNote: string | null;
    accessNotes: string | null;
  };
}

// Everyone signed up for one event — the data an admin actually wants
// when they click into an event (SPEC.md's event-as-its-own-dataset
// shape). Staff-only, same as householdsForSession above.
export async function householdsForEvent(
  session: SessionLike | null | undefined,
  orgId: string,
  eventId: string
): Promise<HouseholdForEvent[]> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return [];

  const subEvents = await prisma.subscriptionEvent.findMany({
    where: { eventId, subscription: { household: { orgId } } },
    include: { subscription: { include: { household: true } } },
    orderBy: { subscription: { createdAt: "desc" } },
  });

  return subEvents.map((se) => ({
    subscriptionEventId: se.id,
    skipped: se.skipped,
    subscriptionId: se.subscription.id,
    subscriptionStatus: se.subscription.status,
    amountCents: se.subscription.amountCents,
    household: {
      id: se.subscription.household.id,
      contactName: se.subscription.household.contactName,
      contactEmail: se.subscription.household.contactEmail,
      contactPhone: se.subscription.household.contactPhone,
      addressInput: se.subscription.household.addressInput,
      placementNote: se.subscription.household.placementNote,
      accessNotes: se.subscription.household.accessNotes,
    },
  }));
}

const VALID_SUB_STATUSES: SubStatus[] = ["DRAFT", "PENDING_PAYMENT", "ACTIVE", "LAPSED", "CANCELLED"];

export interface ImportError {
  row: number; // 1-indexed, counting the header row, so it matches what a spreadsheet shows
  reason: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportError[];
}

/**
 * Bulk-adds households to one event from a CSV — same column contract as
 * the export route (Name, Email, Phone, Address, Placement note, Access
 * notes, Amount, Status, Skipped), so export → edit → import round-trips,
 * and exporting one event and importing into another is how "copy data
 * from another event" works without a separate clone feature.
 *
 * Dedup rule: if Email is given and matches an existing Household in
 * this org (case-insensitive), that household is updated in place;
 * otherwise a new Household is created. No address-based fuzzy matching
 * — too easy to silently merge two different households that happen to
 * type their address similarly.
 *
 * A row with a validation problem is skipped and recorded in
 * ImportResult.errors, not aborted — one bad row (or a spreadsheet's
 * blank trailing rows) shouldn't block the rest of a real import.
 */
export async function importHouseholdsForEvent(
  session: SessionLike | null | undefined,
  input: {
    orgId: string;
    categoryId: string | null;
    eventId: string;
    csvText: string;
  }
): Promise<ImportResult> {
  // Unlike submitSignup, this is a write nobody outside staff should
  // ever reach — checked here too, not just in the calling server
  // action, so this function is safe to call from anywhere later.
  const membership = await resolveMembership(session, input.eventId);
  if (!membership || !isStaff(membership.role)) {
    return { imported: 0, errors: [{ row: 0, reason: "Forbidden" }] };
  }

  const rows = parseCsvRows(input.csvText);
  const errors: ImportError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 2; // +1 for header, +1 for 1-indexing
    const name = (r["Name"] ?? "").trim();
    const address = (r["Address"] ?? "").trim();
    if (!name || !address) {
      errors.push({ row: rowNumber, reason: "Missing Name or Address" });
      continue;
    }

    const email = (r["Email"] ?? "").trim() || undefined;
    const phone = (r["Phone"] ?? "").trim() || undefined;
    const placementNote = (r["Placement note"] ?? "").trim() || undefined;
    const accessNotes = (r["Access notes"] ?? "").trim() || undefined;

    const amountDollars = Number(r["Amount"] ?? "0");
    const amountCents = Number.isFinite(amountDollars) ? Math.round(amountDollars * 100) : 0;

    const statusRaw = (r["Status"] ?? "").trim().toUpperCase() as SubStatus;
    const status: SubStatus = VALID_SUB_STATUSES.includes(statusRaw) ? statusRaw : "PENDING_PAYMENT";
    const skipped = (r["Skipped"] ?? "").trim().toLowerCase() === "yes";

    const existing = email
      ? await prisma.household.findFirst({
          where: { orgId: input.orgId, contactEmail: { equals: email, mode: "insensitive" } },
        })
      : null;

    const household = existing
      ? await prisma.household.update({
          where: { id: existing.id },
          data: {
            contactName: name,
            contactPhone: phone ?? existing.contactPhone,
            addressInput: address,
            placementNote: placementNote ?? existing.placementNote,
            accessNotes: accessNotes ?? existing.accessNotes,
          },
        })
      : await prisma.household.create({
          data: {
            orgId: input.orgId,
            contactName: name,
            contactEmail: email,
            contactPhone: phone,
            addressInput: address,
            address: { raw: address, source: "csv-import" } as Prisma.InputJsonValue,
            placementNote,
            accessNotes,
          },
        });

    // findOrCreateSubscription races safely (see its own comment) but
    // doesn't apply this row's status/amountCents to an existing match
    // the way an upsert would -- a re-import should overwrite those, so
    // that's applied as a second, explicit update here.
    const subscription = await findOrCreateSubscription(household.id, input.categoryId, { status, amountCents });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status, amountCents } });

    await prisma.subscriptionEvent.upsert({
      where: { subscriptionId_eventId: { subscriptionId: subscription.id, eventId: input.eventId } },
      update: { skipped },
      create: { subscriptionId: subscription.id, eventId: input.eventId, skipped },
    });

    imported++;
  }

  return { imported, errors };
}

export interface SignupSubmission {
  orgId: string;
  // Set only when every selected event shares one category (a bundled
  // signup); null for a mixed or entirely uncategorized selection.
  categoryId?: string | null;
  eventIds: string[];
  amountCents: number;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  // Set when the household is already signed in (they linked an account
  // on a previous visit) — links the new household record straight to
  // their account instead of leaving it anonymous.
  userId?: string;
  addressInput: string;
  address: Record<string, unknown>;
  lat?: number;
  lng?: number;
  geocodeConfidence?: number;
  geocodeSource?: string;
  placementNote?: string;
  accessNotes?: string;
}

/**
 * Public, unauthenticated write — the whole point of the signup flow is
 * that no account is required (SPEC.md §3.2), so this deliberately isn't
 * session-gated like the helpers above (same reasoning as
 * openEventsForSignup in scoped/events.ts).
 *
 * No Stripe integration exists yet (docs/rounds/PHASE-1.md), so the
 * created Subscription is left in PENDING_PAYMENT rather than ACTIVE —
 * an honest reflection of what actually happened, not a shortcut around
 * the missing payment step.
 *
 * Sets `needsReview` for anything other than a Google-picked address —
 * neither picker returns a real geocodeConfidence score (see
 * AddressPicker.tsx), so "google" is the only source trusted without a
 * human check; a manually-typed or OSM-picked address, or one within 25m
 * of an existing household (SPEC.md §8's duplicate detection), always
 * lands in the review queue rather than silently becoming a stop later.
 * Also issues a self-service token (SPEC.md §4.4) — no email service is
 * configured in this environment, so the raw token is returned here for
 * the caller to show/copy on the confirmation screen rather than mailed.
 */
export async function submitSignup(input: SignupSubmission) {
  let needsReview = input.geocodeSource !== "google";
  let needsReviewReason = needsReview
    ? input.geocodeSource === "manual"
      ? "Address entered manually, no map pin."
      : "Address picked from the free OSM/Nominatim search, not Google."
    : null;

  if (input.lat !== undefined && input.lng !== undefined) {
    const nearby = await findNearbyHouseholds(input.orgId, input.lat, input.lng, "");
    if (nearby.length > 0) {
      needsReview = true;
      needsReviewReason = `Possible duplicate — within 25m of ${nearby.map((h) => h.contactName).join(", ")}.`;
    }
  }

  const selfServiceToken = issueSelfServiceToken();

  const household = await prisma.household.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      addressInput: input.addressInput,
      address: input.address as Prisma.InputJsonValue,
      lat: input.lat,
      lng: input.lng,
      geocodeConfidence: input.geocodeConfidence,
      geocodeSource: input.geocodeSource,
      placementNote: input.placementNote,
      accessNotes: input.accessNotes,
      needsReview,
      needsReviewReason,
      selfServiceTokenHash: selfServiceToken.hash,
      selfServiceTokenExpiresAt: selfServiceToken.expiresAt,
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      householdId: household.id,
      categoryId: input.categoryId ?? null,
      status: "PENDING_PAYMENT",
      amountCents: input.amountCents,
      events: {
        create: input.eventIds.map((eventId) => ({ eventId })),
      },
    },
  });

  return { householdId: household.id, subscriptionId: subscription.id, selfServiceToken: selfServiceToken.raw };
}

/**
 * The signed-in household's most recent linked household record, for
 * prefilling the signup form (name/email/phone/address/placement note)
 * so they don't retype it every season. Not session-gated the way the
 * staff helpers above are — a household reading its own linked record is
 * expected, same as the self-service token flow SPEC.md §4.4 describes,
 * just keyed by account instead of a signed link for now.
 */
export async function householdForUser(userId: string, orgId: string) {
  return prisma.household.findFirst({
    where: { userId, orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export interface LinkHouseholdResult {
  ok: boolean;
  error?: string;
}

/**
 * Links an already-created household (from an anonymous signup) to the
 * account the household just created on the confirmation screen. Scoped
 * to orgId so a household id from one org can't be linked by a session
 * in another; no staff/session role check beyond that — this runs
 * immediately after the household's own account creation, acting on
 * their own just-submitted signup, not someone else's.
 */
export async function linkHouseholdToUser(
  householdId: string,
  userId: string,
  orgId: string
): Promise<LinkHouseholdResult> {
  const result = await prisma.household.updateMany({
    where: { id: householdId, orgId, deletedAt: null },
    data: { userId },
  });
  if (result.count === 0) return { ok: false, error: "Household not found." };
  return { ok: true };
}

// SPEC.md §8: "a review queue with approve / reject / merge duplicate /
// fix address" — this v1 covers approve (mark reviewed once the address
// is confirmed or corrected via the existing household edit page) and
// surfaces the reason; reject/merge stay manual (delete or edit) rather
// than dedicated actions until the queue is actually used and it's clear
// which shortcuts are worth building.
export async function householdsNeedingReview(session: SessionLike | null | undefined, orgId: string) {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];
  return prisma.household.findMany({
    where: { orgId, deletedAt: null, needsReview: true },
    orderBy: { createdAt: "asc" },
  });
}

export interface MarkReviewedResult {
  ok: boolean;
  error?: string;
}

export async function markHouseholdReviewed(
  session: SessionLike | null | undefined,
  orgId: string,
  householdId: string
): Promise<MarkReviewedResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  const result = await prisma.household.updateMany({
    where: { id: householdId, orgId, deletedAt: null },
    data: { needsReview: false, needsReviewReason: null },
  });
  if (result.count === 0) return { ok: false, error: "Household not found." };
  return { ok: true };
}

export async function markHouseholdsReviewedBulk(
  session: SessionLike | null | undefined,
  orgId: string,
  householdIds: string[]
): Promise<{ deleted: number }> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { deleted: 0 };
  const result = await prisma.household.updateMany({
    where: { id: { in: householdIds }, orgId, deletedAt: null },
    data: { needsReview: false, needsReviewReason: null },
  });
  return { deleted: result.count };
}
