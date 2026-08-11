import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { recordVisit, myRoutesForSession, myRouteDetail } = await import("../visits");

beforeEach(() => {
  vi.clearAllMocks();
});

const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("myRoutesForSession", () => {
  it("a signed-out visitor gets nothing, no query run", async () => {
    const result = await myRoutesForSession(null);
    expect(result).toEqual([]);
    expect(prismaMock.routeAssignment.findMany).not.toHaveBeenCalled();
  });

  it("looks up assignments scoped to this exact user, not by role", async () => {
    await myRoutesForSession(VOLUNTEER);
    expect(prismaMock.routeAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u-vol" } })
    );
  });
});

describe("myRouteDetail", () => {
  it("a signed-out visitor gets nothing", async () => {
    const result = await myRouteDetail(null, "route-1");
    expect(result).toBeNull();
    expect(prismaMock.route.findFirst).not.toHaveBeenCalled();
  });

  it("the route query is scoped to routes this user is assigned to — real query-level redaction", async () => {
    await myRouteDetail(VOLUNTEER, "route-1");
    expect(prismaMock.route.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "route-1", deletedAt: null, assignments: { some: { userId: "u-vol" } } },
      })
    );
  });

  it("returns null if the route doesn't come back (not assigned, wrong id, or deleted)", async () => {
    prismaMock.route.findFirst.mockResolvedValueOnce(null);
    const result = await myRouteDetail(VOLUNTEER, "route-1");
    expect(result).toBeNull();
  });

  it("maps household contact info onto each stop and resolves the event's stop-card layout", async () => {
    prismaMock.route.findFirst.mockResolvedValueOnce({
      id: "route-1",
      name: "Route A",
      event: { id: "ev-1", name: "Pioneer Day", outcomeSet: { outcomes: [] }, layoutBlocks: null },
      stops: [
        {
          id: "stop-1",
          sequence: 1,
          status: "UNASSIGNED",
          addressLine: "123 Main St",
          label: "Corner lot",
          placementNote: null,
          accessNotes: null,
          lat: 40.6,
          lng: -111.9,
          household: { contactName: "Jane Doe", contactPhone: "555-0100" },
        },
      ],
    });
    const result = await myRouteDetail(VOLUNTEER, "route-1");
    expect(result?.stops[0]).toMatchObject({
      label: "Corner lot",
      householdName: "Jane Doe",
      phone: "555-0100",
    });
    expect(result?.stopCardLayout.slots.primary.some((b) => b.blockId === "address" && b.visible)).toBe(true);
  });

  it("handles a stop with no linked household", async () => {
    prismaMock.route.findFirst.mockResolvedValueOnce({
      id: "route-1",
      name: "Route A",
      event: { id: "ev-1", name: "Pioneer Day", outcomeSet: { outcomes: [] }, layoutBlocks: null },
      stops: [
        {
          id: "stop-1",
          sequence: 1,
          status: "UNASSIGNED",
          addressLine: "123 Main St",
          label: null,
          placementNote: null,
          accessNotes: null,
          lat: 40.6,
          lng: -111.9,
          household: null,
        },
      ],
    });
    const result = await myRouteDetail(VOLUNTEER, "route-1");
    expect(result?.stops[0].householdName).toBeNull();
    expect(result?.stops[0].phone).toBeNull();
  });
});

describe("recordVisit", () => {
  const baseInput = {
    stopId: "stop-1",
    routeId: "route-1",
    outcome: "placed",
    disposition: "SUCCESS" as const,
    clientId: "client-1",
  };

  it("rejects a signed-out caller", async () => {
    const result = await recordVisit(null, baseInput);
    expect(result.ok).toBe(false);
    expect(prismaMock.stop.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the stop lookup to routes this user is assigned to", async () => {
    prismaMock.stop.findFirst.mockResolvedValueOnce(null);
    await recordVisit(VOLUNTEER, baseInput);
    expect(prismaMock.stop.findFirst).toHaveBeenCalledWith({
      where: { id: "stop-1", routeId: "route-1", route: { assignments: { some: { userId: "u-vol" } } } },
    });
  });

  it("fails if the stop isn't found (not assigned, or wrong route)", async () => {
    prismaMock.stop.findFirst.mockResolvedValueOnce(null);
    const result = await recordVisit(VOLUNTEER, baseInput);
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("is idempotent — a clientId that already has a Visit is reported as already recorded, not duplicated", async () => {
    prismaMock.stop.findFirst.mockResolvedValueOnce({ id: "stop-1" });
    prismaMock.visit.findUnique.mockResolvedValueOnce({ id: "existing-visit" });
    const result = await recordVisit(VOLUNTEER, baseInput);
    expect(result).toEqual({ ok: true, alreadyRecorded: true });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates the Visit and updates the Stop's status together", async () => {
    prismaMock.stop.findFirst.mockResolvedValueOnce({ id: "stop-1" });
    prismaMock.visit.findUnique.mockResolvedValueOnce(null);
    const result = await recordVisit(VOLUNTEER, baseInput);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
