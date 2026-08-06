import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { householdsForSession, browseHouseholds, updateHousehold, deleteHouseholds, removeHouseholdsFromEvent } =
  await import("../households");

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
