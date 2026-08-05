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
