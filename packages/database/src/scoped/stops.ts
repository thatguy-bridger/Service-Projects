import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

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
    // Route/RouteAssignment ship in Phase 3. Until a volunteer can be
    // assigned to a route, they have no stops to see — by construction,
    // not by an oversight. Kept as an explicit branch (rather than
    // falling into the `return []` below) so the Phase 3 TODO is easy to
    // find: filter by `route.assignments.some(...)` and add a `select`
    // built from the form schema's `visibleTo: Role[]` (SPEC.md §6, §7.2)
    // instead of returning everything.
    return [];
  }

  return [];
}
