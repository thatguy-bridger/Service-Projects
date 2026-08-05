import type { Session } from "next-auth";
import type { Role } from "@service-projects/database";
import { resolveMembership } from "@service-projects/database";

export type { Role };

export interface RequireRoleOptions {
  /** When set, an event-scoped Membership can satisfy the check even if
   *  the session's top-level role doesn't — SPEC.md §3.3: a person can be
   *  a Volunteer on one event and a Coordinator on another. */
  eventId?: string;
}

/**
 * Guard for server actions / route handlers: throws if the session's
 * role — or, when `eventId` is given, the role of its Membership scoped
 * to that event — is not one of `roles`.
 *
 * Single-role call sites from before the five-role migration keep
 * working unchanged: `requireRole(session, "ADMIN")` still throws or
 * passes exactly as it did under the old ADMIN|USER enum. This is now
 * async (it may need a Membership lookup for event-scoped roles), so
 * existing call sites need an `await` added — see
 * apps/route-assignments/src/app/admin/page.tsx.
 */
export async function requireRole(
  session: Session | null,
  roles: Role | Role[],
  options: RequireRoleOptions = {}
): Promise<void> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!session?.user) throw new Error("Forbidden");

  if (session.user.role && allowed.includes(session.user.role)) return;

  if (options.eventId) {
    const membership = await resolveMembership(session, options.eventId);
    if (membership && allowed.includes(membership.role)) return;
  }

  throw new Error("Forbidden");
}
