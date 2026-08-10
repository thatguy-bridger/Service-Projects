import { Prisma, type EventKind, type EventStatus } from "@prisma/client";
import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

export async function eventsForSession(session: SessionLike | null | undefined, orgId: string) {
  const membership = await resolveMembership(session);
  if (membership && isStaff(membership.role)) {
    return prisma.event.findMany({ where: { orgId, deletedAt: null }, orderBy: { serviceStartsAt: "desc" } });
  }
  // Volunteers and previewers only see events open to the public. Once
  // Route/RouteAssignment ship in Phase 3, a volunteer should also see
  // events they're assigned to even if not (yet) OPEN — tracked there.
  return prisma.event.findMany({
    where: { orgId, deletedAt: null, status: "OPEN" },
    orderBy: { serviceStartsAt: "asc" },
  });
}

export async function eventForSession(
  session: SessionLike | null | undefined,
  orgId: string,
  eventId: string
) {
  const membership = await resolveMembership(session, eventId);
  if (!membership) return null;
  const event = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!event) return null;
  if (isStaff(membership.role)) return event;
  if (event.status !== "OPEN") return null;
  return event;
}

export interface CreateEventInput {
  orgId: string;
  kind: EventKind;
  name: string;
  slug: string;
  status?: EventStatus;
  priceCents?: number;
  serviceStartsAt: Date;
  serviceEndsAt: Date;
  timezone?: string;
  modules: Record<string, unknown>;
  outcomeSet: Record<string, unknown>;
  createdBy: string;
}

// Public, unauthenticated read -- the whole point of signup is no
// account required (SPEC.md §3.2). Every currently-open Event across the
// org, with its own price and (if it has one) its Category's bundle
// price -- the replacement for the old "current Season" lookup, which
// only ever showed one year's flag holidays at a time.
export async function openEventsForSignup(orgId: string) {
  const events = await prisma.event.findMany({
    where: { orgId, deletedAt: null, status: "OPEN" },
    orderBy: { serviceStartsAt: "asc" },
    include: { category: { select: { id: true, name: true, priceCents: true, deletedAt: true } } },
  });
  // Prisma's `include` doesn't filter by the related row's own
  // deletedAt -- a soft-deleted Category (categoriesForOrg already
  // hides it from every admin list) would otherwise still show its
  // name/bundle price here, letting a deleted category leak back into
  // the public signup grouping through an event that still points at it.
  return events.map((e) => (e.category?.deletedAt ? { ...e, category: null, categoryId: null } : e));
}

export interface DeleteEventsResult {
  deleted: number;
}

// Soft delete — Event already has deletedAt and every read path here
// filters on it, so this is safe even for events with existing
// signups/people/stops (unlike a hard delete, which would hit foreign
// key constraints from SubscriptionEvent/Membership/Stop).
export async function deleteEvents(
  session: SessionLike | null | undefined,
  orgId: string,
  eventIds: string[]
): Promise<DeleteEventsResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { deleted: 0 };

  const result = await prisma.event.updateMany({
    where: { id: { in: eventIds }, orgId },
    data: { deletedAt: new Date() },
  });
  return { deleted: result.count };
}

export interface UpdateEventInput {
  name?: string;
  status?: EventStatus;
  priceCents?: number;
  serviceStartsAt?: Date;
  serviceEndsAt?: Date;
}

export interface UpdateEventResult {
  ok: boolean;
  error?: string;
}

export async function updateEvent(
  session: SessionLike | null | undefined,
  orgId: string,
  eventId: string,
  input: UpdateEventInput
): Promise<UpdateEventResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.event.updateMany({
    where: { id: eventId, orgId, deletedAt: null },
    data: input,
  });
  if (result.count === 0) return { ok: false, error: "Event not found." };
  return { ok: true };
}

// SPEC.md §2.1/§6: FLAG_SETOUT <-> FLAG_PICKUP is the only pairing
// today, in both directions -- a pickup event can be created from a
// set-out event or vice versa.
const PAIR_KIND: Partial<Record<EventKind, EventKind>> = {
  FLAG_SETOUT: "FLAG_PICKUP",
  FLAG_PICKUP: "FLAG_SETOUT",
};

export interface CreatePairedEventResult {
  ok: boolean;
  error?: string;
  eventId?: string;
}

/**
 * SPEC.md §6/Phase 6: "a Memorial Day pickup event clones its set-out
 * stops with empty routes." Creates the paired event (same category,
 * DRAFT so an admin reviews the date/price before it's public) and
 * copies every Stop from the source event onto it -- fresh (UNASSIGNED,
 * no routeId), each one's `carriedFromStopId` pointing back at the stop
 * it came from. Modules/outcomeSet are the caller's job to resolve (the
 * kind's default module matrix), same as createEvent -- this file
 * doesn't hardcode app-specific module data.
 */
export async function createPairedEvent(
  session: SessionLike | null | undefined,
  orgId: string,
  eventId: string,
  input: {
    name: string;
    slug: string;
    serviceStartsAt: Date;
    serviceEndsAt: Date;
    modules: Record<string, unknown>;
    outcomeSet: Record<string, unknown>;
    createdBy: string;
  }
): Promise<CreatePairedEventResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const source = await prisma.event.findFirst({ where: { id: eventId, orgId, deletedAt: null } });
  if (!source) return { ok: false, error: "Event not found." };
  if (source.pairedEventId) return { ok: false, error: "This event already has a paired event." };

  const pairedKind = PAIR_KIND[source.kind];
  if (!pairedKind) return { ok: false, error: `${source.kind} events can't be paired.` };

  const paired = await prisma.event.create({
    data: {
      orgId,
      categoryId: source.categoryId,
      kind: pairedKind,
      name: input.name,
      slug: input.slug,
      status: "DRAFT",
      priceCents: 0, // the pickup is covered by the original signup, not a separate charge
      serviceStartsAt: input.serviceStartsAt,
      serviceEndsAt: input.serviceEndsAt,
      timezone: source.timezone,
      modules: input.modules as Prisma.InputJsonValue,
      outcomeSet: input.outcomeSet as Prisma.InputJsonValue,
      createdBy: input.createdBy,
    },
  });

  await prisma.event.update({ where: { id: paired.id }, data: { pairedEventId: source.id } });
  await prisma.event.update({ where: { id: source.id }, data: { pairedEventId: paired.id } });

  const sourceStops = await prisma.stop.findMany({ where: { eventId: source.id } });
  if (sourceStops.length > 0) {
    await prisma.stop.createMany({
      data: sourceStops.map((s) => ({
        eventId: paired.id,
        source: s.source,
        householdId: s.householdId,
        carriedFromStopId: s.id,
        status: "UNASSIGNED" as const,
        lat: s.lat,
        lng: s.lng,
        addressLine: s.addressLine,
        label: s.label,
        placementNote: s.placementNote,
        accessNotes: s.accessNotes,
        priority: s.priority,
        estimatedMinutes: s.estimatedMinutes,
      })),
    });
  }

  return { ok: true, eventId: paired.id };
}

// Write side of eventsForSession above. Gating who can call this is the
// caller's job — see apps/rounds/.../admin/events/actions.ts.
export async function createEvent(input: CreateEventInput) {
  return prisma.event.create({
    data: {
      orgId: input.orgId,
      kind: input.kind,
      name: input.name,
      slug: input.slug,
      status: input.status ?? "DRAFT",
      priceCents: input.priceCents ?? 0,
      serviceStartsAt: input.serviceStartsAt,
      serviceEndsAt: input.serviceEndsAt,
      timezone: input.timezone ?? "America/Denver",
      modules: input.modules as Prisma.InputJsonValue,
      outcomeSet: input.outcomeSet as Prisma.InputJsonValue,
      createdBy: input.createdBy,
    },
  });
}
