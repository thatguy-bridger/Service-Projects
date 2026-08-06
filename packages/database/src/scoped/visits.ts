import { prisma } from "../client";
import type { SessionLike } from "./membership";
import type { Disposition, StopStatus } from "@prisma/client";

// Phase 4: the volunteer-facing "my routes" surface. Deliberately not
// staff-gated the way the admin scoped helpers are -- this is a
// volunteer reading their *own* assignments, checked by userId directly
// against RouteAssignment, not by role. A volunteer with no assignments
// just gets an empty list, same as a staff member browsing with no
// events yet.

export interface MyRouteSummary {
  id: string;
  name: string;
  color: string;
  status: string;
  eventId: string;
  eventName: string;
  stopCount: number;
  visitedCount: number;
}

export async function myRoutesForSession(session: SessionLike | null | undefined): Promise<MyRouteSummary[]> {
  const userId = session?.user?.id;
  if (!userId) return [];

  const assignments = await prisma.routeAssignment.findMany({
    where: { userId },
    include: {
      route: {
        include: {
          event: { select: { id: true, name: true } },
          _count: { select: { stops: true } },
        },
      },
    },
  });

  const visitCounts = await prisma.visit.groupBy({
    by: ["routeId"],
    where: { routeId: { in: assignments.map((a) => a.routeId) }, userId },
    _count: { id: true },
  });
  const visitCountByRoute = new Map(visitCounts.map((v) => [v.routeId, v._count.id]));

  return assignments
    .filter((a) => !a.route.deletedAt)
    .map((a) => ({
      id: a.route.id,
      name: a.route.name,
      color: a.route.color,
      status: a.route.status,
      eventId: a.route.event.id,
      eventName: a.route.event.name,
      stopCount: a.route._count.stops,
      visitedCount: visitCountByRoute.get(a.route.id) ?? 0,
    }));
}

export interface MyRouteStop {
  id: string;
  sequence: number | null;
  status: string;
  addressLine: string;
  placementNote: string | null;
  accessNotes: string | null;
  lat: number;
  lng: number;
  lastVisitOutcome: string | null;
}

export interface MyRouteDetail {
  id: string;
  name: string;
  eventId: string;
  eventName: string;
  outcomeOptions: { key: string; disposition: Disposition }[];
  stops: MyRouteStop[];
}

// Real query-level redaction, per SPEC.md §6/§7.2's eventual intent:
// this is scoped by `assignments: { some: { userId } }` in the WHERE
// clause itself, not filtered in application code after a broader
// fetch -- a volunteer's Postgres query for a route they aren't
// assigned to returns nothing, the same guarantee resolveMembership
// gives the admin-side helpers.
export async function myRouteDetail(
  session: SessionLike | null | undefined,
  routeId: string
): Promise<MyRouteDetail | null> {
  const userId = session?.user?.id;
  if (!userId) return null;

  const route = await prisma.route.findFirst({
    where: { id: routeId, deletedAt: null, assignments: { some: { userId } } },
    include: {
      event: { select: { id: true, name: true, outcomeSet: true } },
      stops: { orderBy: { sequence: "asc" } },
    },
  });
  if (!route) return null;

  const lastVisits = await prisma.visit.findMany({
    where: { routeId, userId },
    orderBy: { recordedAt: "desc" },
  });
  const lastOutcomeByStop = new Map<string, string>();
  for (const v of lastVisits) if (!lastOutcomeByStop.has(v.stopId)) lastOutcomeByStop.set(v.stopId, v.outcome);

  const outcomeSet = route.event.outcomeSet as { outcomes?: { key: string; disposition: Disposition }[] } | null;

  return {
    id: route.id,
    name: route.name,
    eventId: route.event.id,
    eventName: route.event.name,
    outcomeOptions: outcomeSet?.outcomes ?? [],
    stops: route.stops.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      status: s.status,
      addressLine: s.addressLine,
      placementNote: s.placementNote,
      accessNotes: s.accessNotes,
      lat: s.lat,
      lng: s.lng,
      lastVisitOutcome: lastOutcomeByStop.get(s.id) ?? null,
    })),
  };
}

export interface RecordVisitInput {
  stopId: string;
  routeId: string;
  outcome: string;
  disposition: Disposition;
  note?: string;
  itemCount?: number;
  amountCents?: number;
  clientId: string;
}

export interface RecordVisitResult {
  ok: boolean;
  error?: string;
  alreadyRecorded?: boolean;
}

const STOP_STATUS_FOR_DISPOSITION: Record<Disposition, StopStatus> = {
  SUCCESS: "DONE",
  NEUTRAL: "DONE",
  FAILED: "ISSUE",
};

export async function recordVisit(
  session: SessionLike | null | undefined,
  input: RecordVisitInput
): Promise<RecordVisitResult> {
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in required." };

  // Same query-level scoping as myRouteDetail -- a visit can only be
  // recorded against a stop on a route this user is actually assigned to.
  const stop = await prisma.stop.findFirst({
    where: { id: input.stopId, routeId: input.routeId, route: { assignments: { some: { userId } } } },
  });
  if (!stop) return { ok: false, error: "Stop not found, or you're not assigned to this route." };

  const existing = await prisma.visit.findUnique({ where: { clientId: input.clientId } });
  if (existing) return { ok: true, alreadyRecorded: true };

  await prisma.$transaction([
    prisma.visit.create({
      data: {
        stopId: input.stopId,
        routeId: input.routeId,
        userId,
        outcome: input.outcome,
        disposition: input.disposition,
        note: input.note,
        itemCount: input.itemCount,
        amountCents: input.amountCents,
        clientId: input.clientId,
      },
    }),
    prisma.stop.update({
      where: { id: input.stopId },
      data: { status: STOP_STATUS_FOR_DISPOSITION[input.disposition] },
    }),
  ]);

  return { ok: true };
}
