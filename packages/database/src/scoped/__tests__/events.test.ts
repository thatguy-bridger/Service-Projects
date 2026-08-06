import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { eventsForSession, deleteEvents, updateEvent } = await import("../events");

beforeEach(() => {
  vi.clearAllMocks();
});

const ADMIN = { user: { id: "u-admin", role: "ADMIN" as const } };
const COORDINATOR = { user: { id: "u-coord", role: "COORDINATOR" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("eventsForSession", () => {
  it("staff see every non-deleted event in the org, any status", async () => {
    await eventsForSession(ADMIN, "org-1");
    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", deletedAt: null },
      orderBy: { serviceStartsAt: "desc" },
    });
  });

  it("non-staff only see OPEN events in the org", async () => {
    await eventsForSession(VOLUNTEER, "org-1");
    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", deletedAt: null, status: "OPEN" },
      orderBy: { serviceStartsAt: "asc" },
    });
  });

  it("a signed-out visitor is treated the same as non-staff (public OPEN events only)", async () => {
    await eventsForSession(null, "org-1");
    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", deletedAt: null, status: "OPEN" },
      orderBy: { serviceStartsAt: "asc" },
    });
  });
});

describe("deleteEvents", () => {
  it("blocks a non-staff caller", async () => {
    const result = await deleteEvents(VOLUNTEER, "org-1", ["ev-1"]);
    expect(result.deleted).toBe(0);
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
  });

  it("a Coordinator (staff, but scoped per-event) can soft-delete org events they administer", async () => {
    await deleteEvents(COORDINATOR, "org-1", ["ev-1", "ev-2"]);
    const call = prismaMock.event.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: { in: ["ev-1", "ev-2"] }, orgId: "org-1" });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });
});

describe("updateEvent — cross-org isolation", () => {
  it("blocks a non-staff caller before any write", async () => {
    const result = await updateEvent(VOLUNTEER, "org-1", "ev-1", { name: "New name" });
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
  });

  it("scopes the update to the caller's orgId, so an event id from a different org can't be reached", async () => {
    await updateEvent(ADMIN, "org-1", "ev-in-another-org", { name: "New name" });
    expect(prismaMock.event.updateMany).toHaveBeenCalledWith({
      where: { id: "ev-in-another-org", orgId: "org-1", deletedAt: null },
      data: { name: "New name" },
    });
  });

  it("reports not-found when the org-scoped update matches nothing", async () => {
    prismaMock.event.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await updateEvent(ADMIN, "org-1", "ev-1", { name: "New name" });
    expect(result).toEqual({ ok: false, error: "Event not found." });
  });
});
