import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const {
  eventsForSession,
  eventForSession,
  deleteEvents,
  updateEvent,
  openEventsForSignup,
  createPairedEvent,
  updateEventStopCardLayout,
  updateEventRouteScreenLayout,
} = await import("../events");

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
      where: {
        orgId: "org-1",
        deletedAt: null,
        status: "OPEN",
        category: { is: { orgId: "org-1", deletedAt: null, publishedAt: { not: null } } },
      },
      orderBy: { serviceStartsAt: "asc" },
    });
  });

  it("a signed-out visitor is treated the same as non-staff (public OPEN events only)", async () => {
    await eventsForSession(null, "org-1");
    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        deletedAt: null,
        status: "OPEN",
        category: { is: { orgId: "org-1", deletedAt: null, publishedAt: { not: null } } },
      },
      orderBy: { serviceStartsAt: "asc" },
    });
  });
});

describe("eventForSession", () => {
  it("staff see the event regardless of status or category publish state", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      status: "DRAFT",
      category: { publishedAt: null, deletedAt: null },
    });
    const result = await eventForSession(ADMIN, "org-1", "ev-1");
    expect(result).toEqual(
      expect.objectContaining({ id: "ev-1", status: "DRAFT" })
    );
  });

  it("non-staff get null for an OPEN event whose category isn't published", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      status: "OPEN",
      category: { publishedAt: null, deletedAt: null },
    });
    const result = await eventForSession(VOLUNTEER, "org-1", "ev-1");
    expect(result).toBeNull();
  });

  it("non-staff get the event when it's OPEN and its category is published", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      status: "OPEN",
      category: { publishedAt: new Date(), deletedAt: null },
    });
    const result = await eventForSession(VOLUNTEER, "org-1", "ev-1");
    expect(result).toEqual(expect.objectContaining({ id: "ev-1" }));
  });

  it("non-staff get null when the category itself is soft-deleted, even if publishedAt is set", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      status: "OPEN",
      category: { publishedAt: new Date(), deletedAt: new Date() },
    });
    const result = await eventForSession(VOLUNTEER, "org-1", "ev-1");
    expect(result).toBeNull();
  });

  it("non-staff get null for an uncategorized event (no category to be published)", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({ id: "ev-1", status: "OPEN", category: null });
    const result = await eventForSession(VOLUNTEER, "org-1", "ev-1");
    expect(result).toBeNull();
  });
});

describe("openEventsForSignup", () => {
  it("is public — no session, no membership check — and only ever asks for OPEN events in a published, non-deleted category", async () => {
    await openEventsForSignup("org-1");
    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        deletedAt: null,
        status: "OPEN",
        category: { is: { orgId: "org-1", deletedAt: null, publishedAt: { not: null } } },
      },
      orderBy: { serviceStartsAt: "asc" },
      include: { category: { select: { id: true, name: true, priceCents: true, deletedAt: true } } },
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

describe("updateEventStopCardLayout", () => {
  it("blocks a non-staff caller before any write", async () => {
    const result = await updateEventStopCardLayout(VOLUNTEER, "org-1", "ev-1", { slots: {} });
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
  });

  it("re-normalizes before persisting, forcing required blocks visible even if the caller tried to hide them", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({ layoutBlocks: null });
    await updateEventStopCardLayout(ADMIN, "org-1", "ev-1", {
      slots: { primary: [{ blockId: "address", visible: false }], secondary: [], actions: [] },
    });
    const call = prismaMock.event.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "ev-1", orgId: "org-1", deletedAt: null });
    const saved = call.data.layoutBlocks;
    expect(saved.volunteer_stop_card.slots.primary.find((b: { blockId: string; visible: boolean }) => b.blockId === "address").visible).toBe(true);
  });

  it("merges into other screens' already-saved layouts instead of clobbering them", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      layoutBlocks: { volunteer_route: { slots: { header: [{ blockId: "progress_bar", visible: true }], peek: [], sheet: [] } } },
    });
    await updateEventStopCardLayout(ADMIN, "org-1", "ev-1", {
      slots: { primary: [{ blockId: "address", visible: true }], secondary: [], actions: [] },
    });
    const saved = prismaMock.event.updateMany.mock.calls[0][0].data.layoutBlocks;
    expect(saved.volunteer_route).toBeDefined();
    expect(saved.volunteer_stop_card).toBeDefined();
  });

  it("reports not-found when the event doesn't exist in this org", async () => {
    const result = await updateEventStopCardLayout(ADMIN, "org-1", "ev-1", { slots: {} });
    expect(result).toEqual({ ok: false, error: "Event not found." });
  });
});

describe("updateEventRouteScreenLayout", () => {
  it("blocks a non-staff caller before any write", async () => {
    const result = await updateEventRouteScreenLayout(VOLUNTEER, "org-1", "ev-1", { slots: {} });
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
  });

  it("forces required blocks (progress bar, next stop, stop list) visible", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({ layoutBlocks: null });
    await updateEventRouteScreenLayout(ADMIN, "org-1", "ev-1", {
      slots: { header: [{ blockId: "progress_bar", visible: false }], peek: [], sheet: [] },
    });
    const saved = prismaMock.event.updateMany.mock.calls[0][0].data.layoutBlocks.volunteer_route;
    expect(saved.slots.header.find((b: { blockId: string; visible: boolean }) => b.blockId === "progress_bar").visible).toBe(true);
  });
});

describe("createPairedEvent", () => {
  const pairedInput = {
    name: "Pioneer Day 2027 — Flag Pickup",
    slug: "pioneer-day-2027-pickup",
    serviceStartsAt: new Date("2027-07-25"),
    serviceEndsAt: new Date("2027-07-25"),
    modules: {},
    outcomeSet: {},
    createdBy: "u-admin",
  };

  it("rejects a non-staff caller", async () => {
    const result = await createPairedEvent(VOLUNTEER, "org-1", "ev-1", pairedInput);
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("fails when the source event doesn't exist in this org", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce(null);
    const result = await createPairedEvent(ADMIN, "org-1", "ev-1", pairedInput);
    expect(result).toEqual({ ok: false, error: "Event not found." });
  });

  it("refuses to pair an event that's already paired", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      orgId: "org-1",
      kind: "FLAG_SETOUT",
      pairedEventId: "ev-existing-pair",
    });
    const result = await createPairedEvent(ADMIN, "org-1", "ev-1", pairedInput);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already has a paired event/);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("refuses to pair a kind with no defined pairing (e.g. FUNDRAISER)", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      orgId: "org-1",
      kind: "FUNDRAISER",
      pairedEventId: null,
    });
    const result = await createPairedEvent(ADMIN, "org-1", "ev-1", pairedInput);
    expect(result.ok).toBe(false);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("creates a FLAG_PICKUP as DRAFT with priceCents 0, links both events, and clones every stop", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-setout",
      orgId: "org-1",
      kind: "FLAG_SETOUT",
      categoryId: "cat-1",
      pairedEventId: null,
      timezone: "America/Denver",
    });
    prismaMock.event.create.mockResolvedValueOnce({ id: "ev-pickup" });
    prismaMock.stop.findMany.mockResolvedValueOnce([
      {
        id: "stop-1",
        source: "SUBSCRIPTION",
        householdId: "hh-1",
        lat: 40.5,
        lng: -111.8,
        addressLine: "1 Main St",
        label: null,
        placementNote: "left of driveway",
        accessNotes: null,
        priority: 0,
        estimatedMinutes: 4,
      },
    ]);

    const result = await createPairedEvent(ADMIN, "org-1", "ev-setout", pairedInput);

    expect(result).toEqual({ ok: true, eventId: "ev-pickup" });
    expect(prismaMock.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "FLAG_PICKUP", status: "DRAFT", priceCents: 0, categoryId: "cat-1" }),
      })
    );
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: "ev-pickup" },
      data: { pairedEventId: "ev-setout" },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { id: "ev-setout" },
      data: { pairedEventId: "ev-pickup" },
    });
    expect(prismaMock.stop.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventId: "ev-pickup",
          carriedFromStopId: "stop-1",
          householdId: "hh-1",
          status: "UNASSIGNED",
        }),
      ],
    });
  });

  it("doesn't call stop.createMany when the source event has no stops", async () => {
    prismaMock.event.findFirst.mockResolvedValueOnce({
      id: "ev-setout",
      orgId: "org-1",
      kind: "FLAG_SETOUT",
      categoryId: null,
      pairedEventId: null,
      timezone: "America/Denver",
    });
    prismaMock.event.create.mockResolvedValueOnce({ id: "ev-pickup" });
    prismaMock.stop.findMany.mockResolvedValueOnce([]);

    await createPairedEvent(ADMIN, "org-1", "ev-setout", pairedInput);
    expect(prismaMock.stop.createMany).not.toHaveBeenCalled();
  });
});
