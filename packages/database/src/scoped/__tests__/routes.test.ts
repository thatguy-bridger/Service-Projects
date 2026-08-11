import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { assignStopsToRoute, createRouteFromStops, renameRoute } = await import("../routes");

beforeEach(() => {
  vi.clearAllMocks();
});

const ADMIN = { user: { id: "u-admin", role: "ADMIN" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("assignStopsToRoute", () => {
  it("rejects a non-staff caller", async () => {
    const result = await assignStopsToRoute(VOLUNTEER, "event-1", "route-1", ["stop-1"]);
    expect(result).toEqual({ assigned: 0, error: "Forbidden" });
    expect(prismaMock.stop.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an empty selection before touching the database", async () => {
    const result = await assignStopsToRoute(ADMIN, "event-1", "route-1", []);
    expect(result).toEqual({ assigned: 0, error: "No stops selected." });
    expect(prismaMock.route.findFirst).not.toHaveBeenCalled();
  });

  it("fails when the route doesn't exist in this event", async () => {
    prismaMock.route.findFirst.mockResolvedValueOnce(null);
    const result = await assignStopsToRoute(ADMIN, "event-1", "route-missing", ["stop-1"]);
    expect(result).toEqual({ assigned: 0, error: "Route not found." });
    expect(prismaMock.stop.updateMany).not.toHaveBeenCalled();
  });

  it("scopes the stop reassignment to this event, bumping only UNASSIGNED stops to ASSIGNED", async () => {
    prismaMock.route.findFirst.mockResolvedValueOnce({ id: "route-1" });
    prismaMock.stop.updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 });
    const result = await assignStopsToRoute(ADMIN, "event-1", "route-1", ["stop-1", "stop-2", "stop-3"]);
    expect(result).toEqual({ assigned: 3 });
    expect(prismaMock.stop.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["stop-1", "stop-2", "stop-3"] }, eventId: "event-1", status: "UNASSIGNED" },
      data: { routeId: "route-1", status: "ASSIGNED" },
    });
    expect(prismaMock.stop.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["stop-1", "stop-2", "stop-3"] }, eventId: "event-1", status: { not: "UNASSIGNED" } },
      data: { routeId: "route-1" },
    });
  });

  it("does not clobber a stop's DONE status when lassoing it onto another route", async () => {
    prismaMock.route.findFirst.mockResolvedValueOnce({ id: "route-1" });
    prismaMock.stop.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const result = await assignStopsToRoute(ADMIN, "event-1", "route-1", ["stop-done"]);
    expect(result).toEqual({ assigned: 1 });
    expect(prismaMock.stop.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: "UNASSIGNED" } }), data: { routeId: "route-1" } })
    );
  });
});

describe("createRouteFromStops", () => {
  it("rejects a non-staff caller", async () => {
    const result = await createRouteFromStops(VOLUNTEER, "event-1", "Lasso route", ["stop-1"]);
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const result = await createRouteFromStops(ADMIN, "event-1", "  ", ["stop-1"]);
    expect(result).toEqual({ ok: false, error: "Name is required." });
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it("rejects an empty selection", async () => {
    const result = await createRouteFromStops(ADMIN, "event-1", "Lasso route", []);
    expect(result).toEqual({ ok: false, error: "No stops selected." });
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it("fails cleanly if none of the selected stop ids actually belong to this event", async () => {
    prismaMock.stop.findMany.mockResolvedValueOnce([]);
    const result = await createRouteFromStops(ADMIN, "event-1", "Lasso route", ["stop-from-elsewhere"]);
    expect(result).toEqual({ ok: false, error: "No stops selected." });
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it("creates a route, 2-opt-orders the selected stops onto it, and sets UNASSIGNED stops to ASSIGNED", async () => {
    prismaMock.stop.findMany.mockResolvedValueOnce([
      { id: "stop-1", lat: 40.5, lng: -111.8, status: "UNASSIGNED" },
      { id: "stop-2", lat: 40.51, lng: -111.81, status: "UNASSIGNED" },
    ]);
    prismaMock.route.create.mockResolvedValueOnce({ id: "route-new" });

    const result = await createRouteFromStops(ADMIN, "event-1", "Lasso route", ["stop-1", "stop-2"]);

    expect(result).toEqual({ ok: true, routeId: "route-new", stopsAssigned: 2 });
    expect(prismaMock.route.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventId: "event-1", name: "Lasso route" }) })
    );
    expect(prismaMock.stop.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.stop.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ routeId: "route-new", status: "ASSIGNED" }) })
    );
  });

  it("preserves a stop's DONE status when it's swept into a brand-new route", async () => {
    prismaMock.stop.findMany.mockResolvedValueOnce([{ id: "stop-done", lat: 40.5, lng: -111.8, status: "DONE" }]);
    prismaMock.route.create.mockResolvedValueOnce({ id: "route-new" });

    await createRouteFromStops(ADMIN, "event-1", "Lasso route", ["stop-done"]);

    expect(prismaMock.stop.update).toHaveBeenCalledWith({
      where: { id: "stop-done" },
      data: { routeId: "route-new", sequence: 0 },
    });
  });
});

describe("renameRoute", () => {
  it("rejects a non-staff caller", async () => {
    const result = await renameRoute(VOLUNTEER, "event-1", "route-1", { briefingMd: "Park at the church lot." });
    expect(result.ok).toBe(false);
    expect(prismaMock.route.updateMany).not.toHaveBeenCalled();
  });

  it("passes briefingMd through to the update", async () => {
    await renameRoute(ADMIN, "event-1", "route-1", { briefingMd: "Park at the church lot." });
    expect(prismaMock.route.updateMany).toHaveBeenCalledWith({
      where: { id: "route-1", eventId: "event-1", deletedAt: null },
      data: { briefingMd: "Park at the church lot." },
    });
  });
});
