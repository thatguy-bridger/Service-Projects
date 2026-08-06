import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

export interface GenerateStopsResult {
  created: number;
  alreadyExisted: number;
  error?: string;
}

/**
 * SPEC.md §8: "Generate stops from subscriptions" — the SUBSCRIPTION
 * stop source. Idempotent on (eventId, householdId), per §5.3: every
 * non-skipped, non-cancelled SubscriptionEvent for this event that
 * doesn't already have a Stop gets one; running it again just reports
 * more `alreadyExisted` rather than duplicating anything. Households
 * still needing address review are skipped — SPEC.md's review queue
 * exists precisely so a bad address doesn't become a stop a volunteer
 * gets sent to.
 */
export async function generateStopsFromSubscriptions(
  session: SessionLike | null | undefined,
  eventId: string
): Promise<GenerateStopsResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) {
    return { created: 0, alreadyExisted: 0, error: "Forbidden" };
  }

  const subscriptionEvents = await prisma.subscriptionEvent.findMany({
    where: {
      eventId,
      skipped: false,
      subscription: { cancelledAt: null },
    },
    include: {
      subscription: { include: { household: true } },
    },
  });

  let created = 0;
  let alreadyExisted = 0;

  for (const se of subscriptionEvents) {
    const household = se.subscription.household;
    if (household.deletedAt) continue;
    if (household.needsReview) continue; // don't route a volunteer to an unverified address
    if (household.lat === null || household.lng === null) continue; // nothing to place a pin at

    if (se.stopId) {
      alreadyExisted++;
      continue;
    }

    // Idempotency isn't only "this SubscriptionEvent already has a
    // stopId" — a stop for this exact (eventId, householdId) pair could
    // already exist from a previous partial run that failed after
    // creating the Stop but before linking it back.
    const existing = await prisma.stop.findFirst({
      where: { eventId, householdId: household.id, source: "SUBSCRIPTION" },
    });
    if (existing) {
      await prisma.subscriptionEvent.update({ where: { id: se.id }, data: { stopId: existing.id } });
      alreadyExisted++;
      continue;
    }

    const stop = await prisma.stop.create({
      data: {
        eventId,
        source: "SUBSCRIPTION",
        householdId: household.id,
        lat: household.lat,
        lng: household.lng,
        addressLine: household.addressInput,
        placementNote: household.placementNote,
        accessNotes: household.accessNotes,
      },
    });
    await prisma.subscriptionEvent.update({ where: { id: se.id }, data: { stopId: stop.id } });
    created++;
  }

  return { created, alreadyExisted };
}

// SPEC.md §6: this is the only place allowed to call `prisma.stop`
// directly (see the ESLint override for this directory in
// packages/config/eslint-preset.js). Everything else calls this.
export async function stopsForSession(session: SessionLike | null | undefined, eventId: string) {
  const membership = await resolveMembership(session, eventId);
  if (!membership) return [];

  if (isStaff(membership.role)) {
    return prisma.stop.findMany({ where: { eventId } });
  }

  if (membership.role === "VOLUNTEER") {
    // Phase 3: a volunteer sees stops on routes they're actually
    // assigned to for this event, nothing else. Field-level redaction
    // via a form schema's `visibleTo: Role[]` (SPEC.md §7.2) still
    // doesn't exist (no form builder yet) — that's the next TODO here,
    // not this one.
    const userId = session?.user?.id;
    if (!userId) return [];
    return prisma.stop.findMany({
      where: { eventId, route: { assignments: { some: { userId } } } },
    });
  }

  return [];
}
