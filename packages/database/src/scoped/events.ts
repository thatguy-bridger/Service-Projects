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
