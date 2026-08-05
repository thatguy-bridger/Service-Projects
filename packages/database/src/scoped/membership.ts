import { prisma } from "../client";
import type { Role } from "../client";

// Deliberately not the next-auth `Session` type: that type only exists
// (with a `role` field) once packages/core-auth's module augmentation is
// in the TS program, and packages/database must not depend on
// packages/core-auth (that would be circular — core-auth already depends
// on database for the Prisma client and this file). Any object shaped
// like a session works.
export interface SessionLike {
  user?: { id: string; role: Role } | null;
}

const STAFF_ROLES: Role[] = ["OWNER", "ADMIN", "COORDINATOR"];

export function isStaff(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/**
 * The one place that decides "what role does this session have, here."
 * SPEC.md §3.3: a person can be a Volunteer on one event and a
 * Coordinator on another, so the session's top-level `User.role` is not
 * enough once a specific event is in play — it has to be resolved against
 * that event's Membership row.
 *
 * OWNER/ADMIN are treated as org-wide by convention (SPEC.md §3.1 — they
 * administer the whole org, not one event at a time), so they short
 * -circuit without a Membership lookup. This assumes a single
 * organization per deployment, which matches the spec's real-world scope
 * (one Salt Lake County volunteer org); multi-org would need this to also
 * check an org-scoped Membership for OWNER/ADMIN. Flagged in
 * docs/rounds/PHASE-0.md.
 */
export async function resolveMembership(
  session: SessionLike | null | undefined,
  eventId?: string
): Promise<{ role: Role } | null> {
  const userId = session?.user?.id;
  const topRole = session?.user?.role;
  if (!userId || !topRole) return null;

  if (topRole === "OWNER" || topRole === "ADMIN") return { role: topRole };
  if (!eventId) return { role: topRole };

  const membership = await prisma.membership.findFirst({
    where: { userId, eventId, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  return membership ? { role: membership.role } : { role: topRole };
}

export async function requireOrgAccess(
  session: SessionLike | null | undefined,
  orgId: string
): Promise<void> {
  const userId = session?.user?.id;
  const topRole = session?.user?.role;
  if (!userId) throw new Error("Forbidden");
  if (topRole === "OWNER" || topRole === "ADMIN") return;

  const membership = await prisma.membership.findFirst({
    where: { userId, orgId, status: "active" },
  });
  if (!membership) throw new Error("Forbidden");
}

export interface EventMembership {
  id: string;
  role: Role;
  user: { id: string; email: string; name: string | null };
}

// The "people on this opportunity" list — SPEC.md §3.3's whole point:
// who has ADMIN/COORDINATOR/VOLUNTEER access to *this* event, which can
// differ from the next one even for the same person.
export async function membershipsForEvent(
  session: SessionLike | null | undefined,
  eventId: string
): Promise<EventMembership[]> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return [];

  const rows = await prisma.membership.findMany({
    where: { eventId, status: "active" },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((m) => ({ id: m.id, role: m.role, user: m.user }));
}

const EVENT_MEMBERSHIP_ROLES: Role[] = ["ADMIN", "COORDINATOR", "VOLUNTEER"];

// Grants a role scoped to one event. If `email` has no User row yet, one
// is created as PREVIEWER (same "pre-create by email" pattern as
// setUserRole in apps/rounds/.../admin/users/actions.ts) — their first
// sign-in attaches to it via allowDangerousEmailAccountLinking.
export async function addEventMembership(
  session: SessionLike | null | undefined,
  input: { orgId: string; eventId: string; email: string; role: Role; grantedBy?: string }
): Promise<{ error?: string }> {
  const membership = await resolveMembership(session, input.eventId);
  if (!membership || !isStaff(membership.role)) return { error: "Forbidden" };
  if (!EVENT_MEMBERSHIP_ROLES.includes(input.role)) {
    return { error: "Event-level access can only be Admin, Coordinator, or Volunteer." };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "PREVIEWER" },
  });

  await prisma.membership.upsert({
    where: {
      orgId_userId_role_eventId: { orgId: input.orgId, userId: user.id, role: input.role, eventId: input.eventId },
    },
    update: { status: "active" },
    create: {
      orgId: input.orgId,
      userId: user.id,
      role: input.role,
      eventId: input.eventId,
      status: "active",
      grantedBy: input.grantedBy,
    },
  });

  return {};
}

export async function removeEventMembership(
  session: SessionLike | null | undefined,
  eventId: string,
  membershipId: string
): Promise<{ error?: string }> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { error: "Forbidden" };

  await prisma.membership.updateMany({
    where: { id: membershipId, eventId },
    data: { status: "removed" },
  });
  return {};
}

export async function updateEventMembershipRole(
  session: SessionLike | null | undefined,
  eventId: string,
  membershipId: string,
  role: Role
): Promise<{ ok: boolean; error?: string }> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.membership.updateMany({
    where: { id: membershipId, eventId },
    data: { role },
  });
  if (result.count === 0) return { ok: false, error: "Person not found." };
  return { ok: true };
}

export async function removeEventMemberships(
  session: SessionLike | null | undefined,
  eventId: string,
  membershipIds: string[]
): Promise<{ removed: number; error?: string }> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { removed: 0, error: "Forbidden" };

  const result = await prisma.membership.updateMany({
    where: { id: { in: membershipIds }, eventId },
    data: { status: "removed" },
  });
  return { removed: result.count };
}

export async function organizationsForSession(session: SessionLike | null | undefined) {
  const userId = session?.user?.id;
  if (!userId) return [];
  if (session?.user?.role === "OWNER" || session?.user?.role === "ADMIN") {
    return prisma.organization.findMany({ where: { deletedAt: null } });
  }
  const memberships = await prisma.membership.findMany({
    where: { userId, status: "active" },
    select: { orgId: true },
    distinct: ["orgId"],
  });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return [];
  return prisma.organization.findMany({ where: { id: { in: orgIds }, deletedAt: null } });
}
