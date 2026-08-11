import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const {
  createCategory,
  renameCategory,
  setCategoryPrice,
  deleteCategories,
  setEventCategory,
  publishCategory,
  unpublishCategory,
} = await import("../categories");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.membership.findFirst.mockResolvedValue(null);
});

const ADMIN = { user: { id: "u-admin", role: "ADMIN" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("createCategory", () => {
  it("rejects a non-staff caller before any write", async () => {
    const result = await createCategory(VOLUNTEER, "org-1", "Fundraisers");
    expect(result.ok).toBe(false);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const result = await createCategory(ADMIN, "org-1", "   ");
    expect(result.ok).toBe(false);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("staff can create a category, scoped to their org", async () => {
    const result = await createCategory(ADMIN, "org-1", "Fundraisers");
    expect(result.ok).toBe(true);
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: "org-1", name: "Fundraisers" }) })
    );
  });
});

describe("renameCategory", () => {
  it("rejects a non-staff caller", async () => {
    const result = await renameCategory(VOLUNTEER, "org-1", "cat-1", "New name");
    expect(result.ok).toBe(false);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("scopes the update to the caller's org and this category", async () => {
    await renameCategory(ADMIN, "org-1", "cat-1", "New name");
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { id: "cat-1", orgId: "org-1", deletedAt: null },
      data: { name: "New name" },
    });
  });
});

describe("setCategoryPrice", () => {
  it("rejects a non-staff caller", async () => {
    const result = await setCategoryPrice(VOLUNTEER, "org-1", "cat-1", 1200);
    expect(result.ok).toBe(false);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("sets a flat bundle price, scoped to the caller's org", async () => {
    const result = await setCategoryPrice(ADMIN, "org-1", "cat-1", 1200);
    expect(result.ok).toBe(true);
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { id: "cat-1", orgId: "org-1", deletedAt: null },
      data: { priceCents: 1200 },
    });
  });

  it("clears the bundle price back to null (sum-of-events pricing)", async () => {
    await setCategoryPrice(ADMIN, "org-1", "cat-1", null);
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceCents: null } })
    );
  });

  it("reports not-found when nothing in this org matches", async () => {
    prismaMock.category.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await setCategoryPrice(ADMIN, "org-1", "cat-missing", 1200);
    expect(result).toEqual({ ok: false, error: "Category not found." });
  });
});

describe("deleteCategories", () => {
  it("rejects a non-staff caller", async () => {
    const result = await deleteCategories(VOLUNTEER, "org-1", ["cat-1"]);
    expect(result.deleted).toBe(0);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("soft-deletes (sets deletedAt) scoped to the caller's org, and cascades to its events", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 2 }, { count: 5 }]);
    const result = await deleteCategories(ADMIN, "org-1", ["cat-1", "cat-2"]);
    expect(result).toEqual({ deleted: 2 });
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cat-1", "cat-2"] }, orgId: "org-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prismaMock.event.updateMany).toHaveBeenCalledWith({
      where: { categoryId: { in: ["cat-1", "cat-2"] }, orgId: "org-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("publishCategory", () => {
  it("rejects a non-staff caller", async () => {
    const result = await publishCategory(VOLUNTEER, "org-1", "cat-1");
    expect(result.ok).toBe(false);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("sets publishedAt and bulk-opens only the category's DRAFT events", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 1 }, { count: 3 }]);
    const result = await publishCategory(ADMIN, "org-1", "cat-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { id: "cat-1", orgId: "org-1", deletedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
    expect(prismaMock.event.updateMany).toHaveBeenCalledWith({
      where: { categoryId: "cat-1", orgId: "org-1", deletedAt: null, status: "DRAFT" },
      data: { status: "OPEN" },
    });
  });

  it("reports not-found when nothing in this org matches", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }]);
    const result = await publishCategory(ADMIN, "org-1", "cat-missing");
    expect(result).toEqual({ ok: false, error: "Category not found." });
  });
});

describe("unpublishCategory", () => {
  it("rejects a non-staff caller", async () => {
    const result = await unpublishCategory(VOLUNTEER, "org-1", "cat-1");
    expect(result.ok).toBe(false);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("clears publishedAt without touching any event", async () => {
    const result = await unpublishCategory(ADMIN, "org-1", "cat-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { id: "cat-1", orgId: "org-1", deletedAt: null },
      data: { publishedAt: null },
    });
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
  });
});

describe("setEventCategory", () => {
  it("rejects a non-staff caller, event-scoped membership included", async () => {
    const result = await setEventCategory(VOLUNTEER, "org-1", "ev-1", "cat-1");
    expect(result.ok).toBe(false);
    expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
  });

  it("staff can move an event to a different category, or clear it (null)", async () => {
    const result = await setEventCategory(ADMIN, "org-1", "ev-1", null);
    expect(result.ok).toBe(true);
    expect(prismaMock.event.updateMany).toHaveBeenCalledWith({
      where: { id: "ev-1", orgId: "org-1", deletedAt: null },
      data: { categoryId: null },
    });
  });
});
