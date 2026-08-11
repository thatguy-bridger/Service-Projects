import { prisma } from "../client";
import { resolveMembership, type SessionLike } from "./membership";
import type { AdminDashboardRoute, AdminDashboardAuditEntry } from "../layoutBlocks";

export type DashboardRoute = AdminDashboardRoute;
export type DashboardAuditEntry = AdminDashboardAuditEntry;

export interface AdminDashboardData {
  needsReviewCount: number;
  unassignedStopsCount: number;
  subscriptionFunnel: { status: string; count: number }[];
  todaysRoutes: DashboardRoute[];
  recentAudit: DashboardAuditEntry[];
}

const EMPTY_DASHBOARD: AdminDashboardData = {
  needsReviewCount: 0,
  unassignedStopsCount: 0,
  subscriptionFunnel: [],
  todaysRoutes: [],
  recentAudit: [],
};

/**
 * SPEC.md §11.3's admin dashboard, minus "renewal campaign status"
 * (not built anywhere in this app yet, no data source). Owner/Admin
 * only -- matches the root page's existing isOwnerOrAdmin gate on the
 * dashboard section this data feeds, tighter than the rest of this
 * package's isStaff (which also allows Coordinator; a Coordinator
 * doesn't have an org-wide view anywhere else either).
 */
export async function adminDashboardData(
  session: SessionLike | null | undefined,
  orgId: string
): Promise<AdminDashboardData> {
  const membership = await resolveMembership(session);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) return EMPTY_DASHBOARD;

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

  const [needsReviewCount, unassignedStopsCount, funnelRows, routes, auditRows] = await Promise.all([
    prisma.household.count({ where: { orgId, deletedAt: null, needsReview: true } }),
    prisma.stop.count({ where: { routeId: null, event: { orgId, deletedAt: null } } }),
    prisma.subscription.groupBy({ by: ["status"], where: { household: { orgId } }, _count: { _all: true } }),
    prisma.route.findMany({
      where: {
        deletedAt: null,
        event: { orgId, deletedAt: null, serviceStartsAt: { lt: endOfToday }, serviceEndsAt: { gte: startOfToday } },
      },
      include: { event: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({ where: { orgId }, orderBy: { at: "desc" }, take: 10 }),
  ]);

  return {
    needsReviewCount,
    unassignedStopsCount,
    subscriptionFunnel: funnelRows.map((r) => ({ status: r.status, count: r._count._all })),
    todaysRoutes: routes.map((r) => ({ id: r.id, name: r.name, eventId: r.event.id, eventName: r.event.name, status: r.status })),
    recentAudit: auditRows.map((a) => ({ action: a.action, entity: a.entity, at: a.at.toISOString() })),
  };
}
