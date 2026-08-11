import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { adminDashboardData } = await import("../dashboard");

const OWNER_SESSION = { user: { id: "u1", role: "OWNER" as const } };
const COORDINATOR_SESSION = { user: { id: "u2", role: "COORDINATOR" as const } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminDashboardData", () => {
  it("returns the empty dashboard for a non-owner/admin session", async () => {
    const result = await adminDashboardData(COORDINATOR_SESSION, "org-1");
    expect(result).toEqual({
      needsReviewCount: 0,
      unassignedStopsCount: 0,
      subscriptionFunnel: [],
      todaysRoutes: [],
      recentAudit: [],
    });
    expect(prismaMock.household.count).not.toHaveBeenCalled();
  });

  it("returns the empty dashboard for no session", async () => {
    const result = await adminDashboardData(null, "org-1");
    expect(result.needsReviewCount).toBe(0);
  });

  it("aggregates the dashboard queries scoped to the given org for an Owner", async () => {
    prismaMock.household.count.mockResolvedValueOnce(4);
    prismaMock.stop.count.mockResolvedValueOnce(12);
    prismaMock.subscription.groupBy.mockResolvedValueOnce([
      { status: "active", _count: { _all: 58 } },
      { status: "paused", _count: { _all: 6 } },
    ]);
    prismaMock.route.findMany.mockResolvedValueOnce([
      { id: "r1", name: "Route A", status: "in_progress", event: { id: "e1", name: "Fall Flags" } },
    ]);
    prismaMock.auditLog.findMany.mockResolvedValueOnce([
      { action: "household.updated", entity: "Household", at: new Date("2026-01-01T00:00:00Z") },
    ]);

    const result = await adminDashboardData(OWNER_SESSION, "org-1");

    expect(prismaMock.household.count).toHaveBeenCalledWith({
      where: { orgId: "org-1", deletedAt: null, needsReview: true },
    });
    expect(prismaMock.stop.count).toHaveBeenCalledWith({
      where: { routeId: null, event: { orgId: "org-1", deletedAt: null } },
    });
    expect(result).toEqual({
      needsReviewCount: 4,
      unassignedStopsCount: 12,
      subscriptionFunnel: [
        { status: "active", count: 58 },
        { status: "paused", count: 6 },
      ],
      todaysRoutes: [{ id: "r1", name: "Route A", eventId: "e1", eventName: "Fall Flags", status: "in_progress" }],
      recentAudit: [{ action: "household.updated", entity: "Household", at: "2026-01-01T00:00:00.000Z" }],
    });
  });
});
