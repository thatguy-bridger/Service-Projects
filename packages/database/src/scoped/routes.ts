import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";
import { orderRouteStops, splitIntoRoutes, routeDistanceMeters } from "../routing";

export interface RouteRow {
  id: string;
  name: string;
  color: string;
  status: string;
  stopCount: number;
  assignedTo: string[]; // volunteer names/emails, for display
}

export async function routesForEvent(
  session: SessionLike | null | undefined,
  eventId: string
): Promise<RouteRow[]> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return [];

  const routes = await prisma.route.findMany({
    where: { eventId, deletedAt: null },
    include: {
      _count: { select: { stops: true } },
      assignments: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return routes.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    status: r.status,
    stopCount: r._count.stops,
    assignedTo: r.assignments.map((a) => a.user.name ?? a.user.email),
  }));
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function renameRoute(
  session: SessionLike | null | undefined,
  eventId: string,
  routeId: string,
  patch: { name?: string; status?: string; color?: string }
): Promise<ActionResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.route.updateMany({
    where: { id: routeId, eventId, deletedAt: null },
    data: patch,
  });
  if (result.count === 0) return { ok: false, error: "Route not found." };
  return { ok: true };
}

export async function deleteRoutes(
  session: SessionLike | null | undefined,
  eventId: string,
  routeIds: string[]
): Promise<{ deleted: number }> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { deleted: 0 };

  // Unassign the route's stops first (their FK is ON DELETE SET NULL at
  // the DB level for a hard delete, but this is a soft delete, so it
  // has to be done explicitly to keep stopsForSession's volunteer query
  // correct -- a stop still pointing at a deleted route would silently
  // vanish from that volunteer's view instead of going back to unassigned).
  await prisma.stop.updateMany({ where: { routeId: { in: routeIds }, eventId }, data: { routeId: null } });
  const result = await prisma.route.updateMany({
    where: { id: { in: routeIds }, eventId },
    data: { deletedAt: new Date() },
  });
  return { deleted: result.count };
}

export async function createRoute(
  session: SessionLike | null | undefined,
  eventId: string,
  name: string
): Promise<ActionResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  if (!name.trim()) return { ok: false, error: "Name is required." };

  await prisma.route.create({
    data: { eventId, name: name.trim(), createdBy: session!.user!.id },
  });
  return { ok: true };
}

export interface AutoSplitResult {
  routesCreated: number;
  stopsAssigned: number;
  error?: string;
}

// SPEC.md §9.3: "auto-split, 2-opt ordering" — takes every UNASSIGNED
// stop for this event with no route yet, splits them geographically
// into `routeCount` groups (packages/database/src/routing.ts's
// snake-sort), 2-opt-orders each group into a real short route, and
// creates a Route row per group with its stops' `sequence` set to that
// order. Existing routes and their stops are left untouched -- this
// only ever picks up stops that aren't on a route yet, so re-running it
// after manually tweaking one route is safe.
export async function autoSplitStopsIntoRoutes(
  session: SessionLike | null | undefined,
  eventId: string,
  routeCount: number
): Promise<AutoSplitResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { routesCreated: 0, stopsAssigned: 0, error: "Forbidden" };
  if (routeCount < 1) return { routesCreated: 0, stopsAssigned: 0, error: "Need at least one route." };

  const unassigned = await prisma.stop.findMany({
    where: { eventId, routeId: null },
    select: { id: true, lat: true, lng: true },
  });
  if (unassigned.length === 0) {
    return { routesCreated: 0, stopsAssigned: 0, error: "No unassigned stops to split." };
  }

  const groups = splitIntoRoutes(unassigned, routeCount);
  const createdBy = session!.user!.id;
  let stopsAssigned = 0;

  for (let i = 0; i < groups.length; i++) {
    const ordered = orderRouteStops(groups[i]);
    const route = await prisma.route.create({
      data: { eventId, name: `Route ${i + 1}`, createdBy },
    });
    for (let seq = 0; seq < ordered.length; seq++) {
      await prisma.stop.update({
        where: { id: ordered[seq].id },
        data: { routeId: route.id, sequence: seq, status: "ASSIGNED" },
      });
    }
    stopsAssigned += ordered.length;
  }

  return { routesCreated: groups.length, stopsAssigned };
}

export async function routeDistancePreview(
  session: SessionLike | null | undefined,
  eventId: string,
  routeId: string
): Promise<number | null> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return null;

  const stops = await prisma.stop.findMany({
    where: { routeId, eventId },
    orderBy: { sequence: "asc" },
    select: { id: true, lat: true, lng: true },
  });
  if (stops.length < 2) return 0;
  return routeDistanceMeters(stops);
}

export async function assignVolunteerToRoute(
  session: SessionLike | null | undefined,
  eventId: string,
  routeId: string,
  email: string
): Promise<ActionResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  if (!email.trim()) return { ok: false, error: "Email is required." };

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return { ok: false, error: "No account with that email yet — have them sign in once first." };

  await prisma.routeAssignment.upsert({
    where: { routeId_userId: { routeId, userId: user.id } },
    update: {},
    create: { routeId, userId: user.id, assignedBy: session!.user!.id },
  });
  return { ok: true };
}

export async function removeRouteAssignments(
  session: SessionLike | null | undefined,
  eventId: string,
  routeId: string,
  userIds: string[]
): Promise<{ deleted: number }> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { deleted: 0 };

  const result = await prisma.routeAssignment.deleteMany({
    where: { routeId, userId: { in: userIds } },
  });
  return { deleted: result.count };
}
