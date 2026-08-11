import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const {
  householdsForSession,
  browseHouseholds,
  updateHousehold,
  deleteHouseholds,
  removeHouseholdsFromEvent,
  householdsNeedingReview,
  markHouseholdReviewed,
  findNearbyHouseholds,
  copyHouseholdsToEvent,
  importHouseholdsForEvent,
  submitSignup,
  signedUpHouseholdsInBounds,
  signedUpHouseholdsInPolygon,
  householdRetentionSummary,
} = await import("../households");

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const OWNER = { user: { id: "u-owner", role: "OWNER" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };
const PREVIEWER = { user: { id: "u-prev", role: "PREVIEWER" as const } };

describe("householdsForSession", () => {
  it("returns nothing for a signed-out session", async () => {
    const result = await householdsForSession(null, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.household.findMany).not.toHaveBeenCalled();
  });

  it("returns nothing for a Previewer — SPEC.md §6: only staff read household data", async () => {
    const result = await householdsForSession(PREVIEWER, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.household.findMany).not.toHaveBeenCalled();
  });

  it("returns nothing for a Volunteer with no event context — household data isn't theirs to browse", async () => {
    const result = await householdsForSession(VOLUNTEER, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.household.findMany).not.toHaveBeenCalled();
  });

  it("queries scoped to the caller's org for staff", async () => {
    await householdsForSession(OWNER, "org-1");
    expect(prismaMock.household.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", deletedAt: null },
    });
  });
});

describe("browseHouseholds", () => {
  it("returns an empty page for a non-staff session instead of querying", async () => {
    const result = await browseHouseholds(VOLUNTEER, "org-1");
    expect(result).toEqual({ households: [], total: 0, page: 1, pageSize: 0 });
    expect(prismaMock.household.findMany).not.toHaveBeenCalled();
    expect(prismaMock.household.count).not.toHaveBeenCalled();
  });

  it("scopes the where clause to the caller's org even when a query string is given", async () => {
    await browseHouseholds(OWNER, "org-1", { query: "Main St" });
    const call = prismaMock.household.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe("org-1");
    expect(call.where.deletedAt).toBeNull();
  });
});

describe("updateHousehold — cross-org isolation", () => {
  it("blocks a non-staff caller before any write", async () => {
    const result = await updateHousehold(VOLUNTEER, "org-1", "hh-1", { contactName: "New Name" });
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.household.updateMany).not.toHaveBeenCalled();
  });

  it("scopes the update to the caller's orgId, so a household id from a different org can't be reached", async () => {
    await updateHousehold(OWNER, "org-1", "hh-in-another-org", { contactName: "New Name" });
    expect(prismaMock.household.updateMany).toHaveBeenCalledWith({
      where: { id: "hh-in-another-org", orgId: "org-1", deletedAt: null },
      data: { contactName: "New Name" },
    });
  });

  it("reports not-found when the org-scoped update matches nothing", async () => {
    prismaMock.household.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await updateHousehold(OWNER, "org-1", "hh-1", { contactName: "New Name" });
    expect(result).toEqual({ ok: false, error: "Household not found." });
  });
});

describe("deleteHouseholds", () => {
  it("blocks a non-staff caller", async () => {
    const result = await deleteHouseholds(VOLUNTEER, "org-1", ["hh-1", "hh-2"]);
    expect(result.deleted).toBe(0);
    expect(result.errors[0].reason).toBe("Forbidden");
    expect(prismaMock.household.updateMany).not.toHaveBeenCalled();
  });

  it("soft-deletes (sets deletedAt) scoped to the caller's org, never a hard delete", async () => {
    await deleteHouseholds(OWNER, "org-1", ["hh-1", "hh-2"]);
    const call = prismaMock.household.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: { in: ["hh-1", "hh-2"] }, orgId: "org-1" });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });
});

describe("removeHouseholdsFromEvent", () => {
  it("blocks a non-staff caller from unlinking a household from an event", async () => {
    const result = await removeHouseholdsFromEvent(VOLUNTEER, "event-1", ["se-1"]);
    expect(result.deleted).toBe(0);
    expect(result.errors[0].reason).toBe("Forbidden");
    expect(prismaMock.subscriptionEvent.deleteMany).not.toHaveBeenCalled();
  });

  it("scopes the delete to the given eventId", async () => {
    await removeHouseholdsFromEvent(OWNER, "event-1", ["se-1", "se-2"]);
    expect(prismaMock.subscriptionEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["se-1", "se-2"] }, eventId: "event-1" },
    });
  });
});

describe("householdsNeedingReview", () => {
  it("returns nothing for a non-staff session", async () => {
    const result = await householdsNeedingReview(VOLUNTEER, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.household.findMany).not.toHaveBeenCalled();
  });

  it("scopes to the caller's org and needsReview=true", async () => {
    await householdsNeedingReview(OWNER, "org-1");
    expect(prismaMock.household.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", deletedAt: null, needsReview: true },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("markHouseholdReviewed", () => {
  it("blocks a non-staff caller", async () => {
    const result = await markHouseholdReviewed(VOLUNTEER, "org-1", "hh-1");
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.household.updateMany).not.toHaveBeenCalled();
  });

  it("clears needsReview scoped to the caller's org", async () => {
    await markHouseholdReviewed(OWNER, "org-1", "hh-in-another-org");
    expect(prismaMock.household.updateMany).toHaveBeenCalledWith({
      where: { id: "hh-in-another-org", orgId: "org-1", deletedAt: null },
      data: { needsReview: false, needsReviewReason: null },
    });
  });

  it("reports not-found when the org-scoped update matches nothing", async () => {
    prismaMock.household.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await markHouseholdReviewed(OWNER, "org-1", "hh-1");
    expect(result).toEqual({ ok: false, error: "Household not found." });
  });
});

describe("findNearbyHouseholds", () => {
  it("excludes the given household id and scopes to the org via the raw query", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "hh-2", contactName: "Neighbor" }]);
    const result = await findNearbyHouseholds("org-1", 40.5, -111.8, "hh-1");
    expect(result).toEqual([{ id: "hh-2", contactName: "Neighbor" }]);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("signedUpHouseholdsInBounds", () => {
  const BOUNDS = { minLat: 40.5, maxLat: 40.6, minLng: -111.9, maxLng: -111.8 };

  it("returns nothing for a non-staff caller", async () => {
    const result = await signedUpHouseholdsInBounds(VOLUNTEER, "org-1", BOUNDS);
    expect(result).toEqual({ points: [], truncated: false });
    expect(prismaMock.household.findMany).not.toHaveBeenCalled();
  });

  it("scopes to the org and the lat/lng box", async () => {
    prismaMock.household.findMany.mockResolvedValueOnce([
      { id: "hh-1", lat: 40.55, lng: -111.85, contactName: "Jane Doe", addressInput: "123 Main St" },
    ]);
    const result = await signedUpHouseholdsInBounds(OWNER, "org-1", BOUNDS);
    expect(result).toEqual({
      points: [{ id: "hh-1", lat: 40.55, lng: -111.85, contactName: "Jane Doe", addressInput: "123 Main St" }],
      truncated: false,
    });
    expect(prismaMock.household.findMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        deletedAt: null,
        lat: { gte: 40.5, lte: 40.6 },
        lng: { gte: -111.9, lte: -111.8 },
      },
      select: { id: true, lat: true, lng: true, contactName: true, addressInput: true },
      take: 1001,
    });
  });
});

describe("signedUpHouseholdsInPolygon", () => {
  const SQUARE = { type: "Polygon" as const, coordinates: [[[-111.9, 40.7], [-111.8, 40.7], [-111.8, 40.6], [-111.9, 40.6]]] };

  it("returns nothing for a non-staff caller", async () => {
    const result = await signedUpHouseholdsInPolygon(VOLUNTEER, "org-1", SQUARE);
    expect(result).toEqual({ points: [], truncated: false });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("runs the ST_Contains query scoped to the org", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: "hh-1", lat: 40.65, lng: -111.85, contactName: "Jane Doe", addressInput: "123 Main St" },
    ]);
    const result = await signedUpHouseholdsInPolygon(OWNER, "org-1", SQUARE);
    expect(result).toEqual({
      points: [{ id: "hh-1", lat: 40.65, lng: -111.85, contactName: "Jane Doe", addressInput: "123 Main St" }],
      truncated: false,
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("householdRetentionSummary", () => {
  function monthsAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n * 30.44);
    return d;
  }

  it("returns nothing for a non-staff caller", async () => {
    const result = await householdRetentionSummary(VOLUNTEER, "org-1");
    expect(result).toEqual({ pastRetentionCount: 0, dueSoonCount: 0, pastRetention: [] });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("classifies households past the 24-month mark separately from ones due soon", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: "hh-recent", contactName: "Recent Household", addressInput: "1 Recent St", lastEventAt: monthsAgo(1) },
      { id: "hh-due-soon", contactName: "Due Soon Household", addressInput: "2 Soon St", lastEventAt: monthsAgo(22) },
      { id: "hh-overdue", contactName: "Overdue Household", addressInput: "3 Late St", lastEventAt: monthsAgo(30) },
    ]);
    const result = await householdRetentionSummary(OWNER, "org-1");
    expect(result.pastRetentionCount).toBe(1);
    expect(result.dueSoonCount).toBe(1);
    expect(result.pastRetention).toHaveLength(1);
    expect(result.pastRetention[0].id).toBe("hh-overdue");
    expect(result.pastRetention[0].monthsSinceLastEvent).toBeGreaterThanOrEqual(29);
  });

  it("sorts the past-retention list most-overdue first", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { id: "hh-a", contactName: "A", addressInput: "a", lastEventAt: monthsAgo(25) },
      { id: "hh-b", contactName: "B", addressInput: "b", lastEventAt: monthsAgo(40) },
    ]);
    const result = await householdRetentionSummary(OWNER, "org-1");
    expect(result.pastRetention.map((h) => h.id)).toEqual(["hh-b", "hh-a"]);
  });
});

describe("copyHouseholdsToEvent", () => {
  it("rejects a non-staff caller", async () => {
    const result = await copyHouseholdsToEvent(VOLUNTEER, {
      orgId: "org-1",
      eventId: "event-1",
      categoryId: null,
      amountCents: 1200,
      householdIds: ["hh-1"],
    });
    expect(result).toEqual({ copied: 0, error: "Forbidden" });
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  it("skips a household id that doesn't belong to this org", async () => {
    prismaMock.household.findFirst.mockResolvedValueOnce(null);
    const result = await copyHouseholdsToEvent(OWNER, {
      orgId: "org-1",
      eventId: "event-1",
      categoryId: null,
      amountCents: 1200,
      householdIds: ["hh-other-org"],
    });
    expect(result).toEqual({ copied: 0 });
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  it("creates a fresh Subscription for a new household+category pair", async () => {
    prismaMock.household.findFirst.mockResolvedValueOnce({ id: "hh-1", orgId: "org-1" });
    prismaMock.subscription.create.mockResolvedValueOnce({ id: "sub-1" });
    const result = await copyHouseholdsToEvent(OWNER, {
      orgId: "org-1",
      eventId: "event-1",
      categoryId: "cat-1",
      amountCents: 1200,
      householdIds: ["hh-1"],
    });
    expect(result).toEqual({ copied: 1 });
    expect(prismaMock.subscription.create).toHaveBeenCalledWith({
      data: { householdId: "hh-1", categoryId: "cat-1", status: "PENDING_PAYMENT", amountCents: 1200 },
    });
    expect(prismaMock.subscriptionEvent.upsert).toHaveBeenCalledWith({
      where: { subscriptionId_eventId: { subscriptionId: "sub-1", eventId: "event-1" } },
      update: {},
      create: { subscriptionId: "sub-1", eventId: "event-1" },
    });
  });

  it("reuses the existing Subscription when a concurrent request already created it (P2002 race)", async () => {
    prismaMock.household.findFirst.mockResolvedValueOnce({ id: "hh-1", orgId: "org-1" });
    prismaMock.subscription.create.mockRejectedValueOnce(uniqueConstraintError());
    prismaMock.subscription.findFirst.mockResolvedValueOnce({ id: "sub-existing" });
    const result = await copyHouseholdsToEvent(OWNER, {
      orgId: "org-1",
      eventId: "event-1",
      categoryId: "cat-1",
      amountCents: 1200,
      householdIds: ["hh-1"],
    });
    expect(result).toEqual({ copied: 1 });
    expect(prismaMock.subscriptionEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subscriptionId_eventId: { subscriptionId: "sub-existing", eventId: "event-1" } } })
    );
  });

  it("re-throws a non-conflict error instead of swallowing it", async () => {
    prismaMock.household.findFirst.mockResolvedValueOnce({ id: "hh-1", orgId: "org-1" });
    prismaMock.subscription.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(
      copyHouseholdsToEvent(OWNER, {
        orgId: "org-1",
        eventId: "event-1",
        categoryId: "cat-1",
        amountCents: 1200,
        householdIds: ["hh-1"],
      })
    ).rejects.toThrow("connection lost");
  });
});

describe("importHouseholdsForEvent", () => {
  const baseInput = { orgId: "org-1", categoryId: "cat-1" as string | null, eventId: "event-1" };

  it("rejects a non-staff caller", async () => {
    const result = await importHouseholdsForEvent(VOLUNTEER, { ...baseInput, csvText: "Name,Address\nA,1 Main St" });
    expect(result.imported).toBe(0);
    expect(result.errors[0].reason).toBe("Forbidden");
  });

  it("skips a row missing Name or Address and records why", async () => {
    const result = await importHouseholdsForEvent(OWNER, { ...baseInput, csvText: "Name,Address\n,1 Main St" });
    expect(result.imported).toBe(0);
    expect(result.errors).toEqual([{ row: 2, reason: "Missing Name or Address" }]);
  });

  it("creates a household and Subscription for a valid row, applying this row's amount/status", async () => {
    prismaMock.household.findFirst.mockResolvedValueOnce(null); // no email match
    prismaMock.household.create.mockResolvedValueOnce({ id: "hh-new" });
    prismaMock.subscription.create.mockResolvedValueOnce({ id: "sub-1" });
    const result = await importHouseholdsForEvent(OWNER, {
      ...baseInput,
      csvText: "Name,Address,Amount,Status\nJane Doe,1 Main St,12.00,ACTIVE",
    });
    expect(result.imported).toBe(1);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "ACTIVE", amountCents: 1200 },
    });
  });

  it("reuses the Subscription a concurrent import already created (P2002 race), then applies this row's data", async () => {
    prismaMock.household.findFirst.mockResolvedValueOnce(null);
    prismaMock.household.create.mockResolvedValueOnce({ id: "hh-new" });
    prismaMock.subscription.create.mockRejectedValueOnce(uniqueConstraintError());
    prismaMock.subscription.findFirst.mockResolvedValueOnce({ id: "sub-existing" });
    const result = await importHouseholdsForEvent(OWNER, {
      ...baseInput,
      csvText: "Name,Address,Amount\nJane Doe,1 Main St,12.00",
    });
    expect(result.imported).toBe(1);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sub-existing" } })
    );
  });
});

describe("submitSignup", () => {
  const baseInput = {
    orgId: "org-1",
    categoryId: null as string | null,
    eventIds: ["event-1", "event-2"],
    amountCents: 2400,
    contactName: "Jane Doe",
    addressInput: "1 Main St",
    address: {},
    lat: 40.5,
    lng: -111.8,
    geocodeSource: "google",
  };

  it("creates the Household and a single Subscription covering every selected event", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // no nearby duplicates
    prismaMock.household.create.mockResolvedValueOnce({ id: "hh-new" });
    prismaMock.subscription.create.mockResolvedValueOnce({ id: "sub-1" });
    const result = await submitSignup(baseInput);
    expect(result.householdId).toBe("hh-new");
    expect(result.subscriptionId).toBe("sub-1");
    expect(prismaMock.subscription.create).toHaveBeenCalledWith({
      data: {
        householdId: "hh-new",
        categoryId: null,
        status: "PENDING_PAYMENT",
        amountCents: 2400,
        events: { create: [{ eventId: "event-1" }, { eventId: "event-2" }] },
      },
    });
  });

  it("flags needsReview when the address wasn't Google-picked", async () => {
    prismaMock.household.create.mockResolvedValueOnce({ id: "hh-new" });
    prismaMock.subscription.create.mockResolvedValueOnce({ id: "sub-1" });
    await submitSignup({ ...baseInput, geocodeSource: "manual" });
    expect(prismaMock.household.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ needsReview: true, needsReviewReason: "Address entered manually, no map pin." }),
      })
    );
  });

  it("flags needsReview when a nearby household already exists (possible duplicate)", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "hh-2", contactName: "Neighbor" }]);
    prismaMock.household.create.mockResolvedValueOnce({ id: "hh-new" });
    prismaMock.subscription.create.mockResolvedValueOnce({ id: "sub-1" });
    await submitSignup(baseInput);
    expect(prismaMock.household.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ needsReview: true, needsReviewReason: expect.stringContaining("Possible duplicate") }),
      })
    );
  });
});
