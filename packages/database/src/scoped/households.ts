import { Prisma } from "@prisma/client";
import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

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

export interface SignupSubmission {
  orgId: string;
  seasonId: string;
  eventIds: string[];
  amountCents: number;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
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
 * currentSeasonForOrg in scoped/seasons.ts).
 *
 * No Stripe integration exists yet (docs/rounds/PHASE-1.md), so the
 * created Subscription is left in PENDING_PAYMENT rather than ACTIVE —
 * an honest reflection of what actually happened, not a shortcut around
 * the missing payment step.
 */
export async function submitSignup(input: SignupSubmission) {
  const household = await prisma.household.create({
    data: {
      orgId: input.orgId,
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
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      householdId: household.id,
      seasonId: input.seasonId,
      status: "PENDING_PAYMENT",
      amountCents: input.amountCents,
      events: {
        create: input.eventIds.map((eventId) => ({ eventId })),
      },
    },
  });

  return { householdId: household.id, subscriptionId: subscription.id };
}
