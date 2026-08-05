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
