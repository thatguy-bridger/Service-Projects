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
  seasonId?: string;
  kind: EventKind;
  name: string;
  slug: string;
  status?: EventStatus;
  serviceStartsAt: Date;
  serviceEndsAt: Date;
  timezone?: string;
  modules: Record<string, unknown>;
  outcomeSet: Record<string, unknown>;
  createdBy: string;
}

// Write side of eventsForSession above. Gating who can call this is the
// caller's job — see apps/rounds/.../admin/events/actions.ts.
export async function createEvent(input: CreateEventInput) {
  return prisma.event.create({
    data: {
      orgId: input.orgId,
      seasonId: input.seasonId,
      kind: input.kind,
      name: input.name,
      slug: input.slug,
      status: input.status ?? "DRAFT",
      serviceStartsAt: input.serviceStartsAt,
      serviceEndsAt: input.serviceEndsAt,
      timezone: input.timezone ?? "America/Denver",
      modules: input.modules as Prisma.InputJsonValue,
      outcomeSet: input.outcomeSet as Prisma.InputJsonValue,
      createdBy: input.createdBy,
    },
  });
}
