import { Prisma } from "@prisma/client";
import { prisma } from "../client";
import { hashToken, findNearbyHouseholds } from "./households";

// SPEC.md §4.4: the household self-service page — `/h/<token>`, no
// login. Authorization here is "possession of the raw token", not a
// session role, so every function takes the raw token and re-derives
// its hash rather than trusting a caller-supplied householdId (which
// would let anyone edit any household by guessing an id). Scoped to
// orgId too, so a token from one org's household can't be probed
// against another org's data even by coincidence.
async function householdForToken(orgId: string, rawToken: string) {
  if (!rawToken) return null;
  const household = await prisma.household.findFirst({
    where: {
      orgId,
      deletedAt: null,
      selfServiceTokenHash: hashToken(rawToken),
    },
  });
  if (!household) return null;
  if (household.selfServiceTokenExpiresAt && household.selfServiceTokenExpiresAt < new Date()) return null;
  return household;
}

export interface SelfServiceHolidayRow {
  subscriptionEventId: string;
  eventId: string;
  eventName: string;
  serviceStartsAt: Date;
  skipped: boolean;
}

export interface SelfServiceSubscriptionRow {
  subscriptionId: string;
  seasonName: string;
  seasonYear: number;
  status: string;
  cancelledAt: Date | null;
  holidays: SelfServiceHolidayRow[];
}

export interface SelfServiceView {
  household: {
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    addressInput: string;
    placementNote: string | null;
    accessNotes: string | null;
  };
  subscriptions: SelfServiceSubscriptionRow[];
}

/** The whole self-service page's data in one call — token holder's own record only. */
export async function selfServiceView(orgId: string, rawToken: string): Promise<SelfServiceView | null> {
  const household = await householdForToken(orgId, rawToken);
  if (!household) return null;

  const subscriptions = await prisma.subscription.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "desc" },
    include: {
      season: true,
      events: { include: { event: true }, orderBy: { event: { serviceStartsAt: "asc" } } },
    },
  });

  return {
    household: {
      contactName: household.contactName,
      contactEmail: household.contactEmail,
      contactPhone: household.contactPhone,
      addressInput: household.addressInput,
      placementNote: household.placementNote,
      accessNotes: household.accessNotes,
    },
    subscriptions: subscriptions.map((s) => ({
      subscriptionId: s.id,
      seasonName: s.season.name,
      seasonYear: s.season.year,
      status: s.status,
      cancelledAt: s.cancelledAt,
      holidays: s.events.map((se) => ({
        subscriptionEventId: se.id,
        eventId: se.eventId,
        eventName: se.event.name,
        serviceStartsAt: se.event.serviceStartsAt,
        skipped: se.skipped,
      })),
    })),
  };
}

export interface SelfServiceResult {
  ok: boolean;
  error?: string;
}

/**
 * Placement note / access notes edits — never touches address (see
 * updateAddress below, which has its own review-flagging rules).
 */
export async function selfServiceUpdateNotes(
  orgId: string,
  rawToken: string,
  input: { placementNote?: string; accessNotes?: string }
): Promise<SelfServiceResult> {
  const household = await householdForToken(orgId, rawToken);
  if (!household) return { ok: false, error: "Link not found or expired." };
  await prisma.household.update({
    where: { id: household.id },
    data: { placementNote: input.placementNote, accessNotes: input.accessNotes },
  });
  return { ok: true };
}

/**
 * SPEC.md §4.4: "Update the address. This re-geocodes and flags the
 * household for admin review rather than silently moving a pin on a
 * route that may already be assigned." Every self-service address
 * change sets needsReview — unlike signup, there's no "trusted" source
 * here, since a route may already exist for a stop generated from the
 * household's old address (Route/RouteAssignment ship Phase 3; the
 * needsReview flag is what makes that safe today and later).
 */
export async function selfServiceUpdateAddress(
  orgId: string,
  rawToken: string,
  input: { addressInput: string; address: Record<string, unknown>; lat: number | null; lng: number | null; geocodeSource: string }
): Promise<SelfServiceResult> {
  const household = await householdForToken(orgId, rawToken);
  if (!household) return { ok: false, error: "Link not found or expired." };

  let reason = "Address changed via self-service — needs a human check before routing.";
  if (input.lat !== null && input.lng !== null) {
    const nearby = await findNearbyHouseholds(orgId, input.lat, input.lng, household.id);
    if (nearby.length > 0) {
      reason = `Address changed via self-service — possible duplicate of ${nearby.map((h) => h.contactName).join(", ")}.`;
    }
  }

  await prisma.household.update({
    where: { id: household.id },
    data: {
      addressInput: input.addressInput,
      address: input.address as Prisma.InputJsonValue,
      lat: input.lat,
      lng: input.lng,
      geocodeSource: input.geocodeSource,
      needsReview: true,
      needsReviewReason: reason,
    },
  });
  return { ok: true };
}

/** Skip (or un-skip) one holiday without cancelling the subscription. */
export async function selfServiceToggleSkip(
  orgId: string,
  rawToken: string,
  subscriptionEventId: string,
  skipped: boolean
): Promise<SelfServiceResult> {
  const household = await householdForToken(orgId, rawToken);
  if (!household) return { ok: false, error: "Link not found or expired." };

  const result = await prisma.subscriptionEvent.updateMany({
    where: { id: subscriptionEventId, subscription: { householdId: household.id } },
    data: { skipped },
  });
  if (result.count === 0) return { ok: false, error: "Not found." };
  return { ok: true };
}

export async function selfServiceCancelSubscription(
  orgId: string,
  rawToken: string,
  subscriptionId: string
): Promise<SelfServiceResult> {
  const household = await householdForToken(orgId, rawToken);
  if (!household) return { ok: false, error: "Link not found or expired." };

  const result = await prisma.subscription.updateMany({
    where: { id: subscriptionId, householdId: household.id, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: "Not found." };
  return { ok: true };
}
