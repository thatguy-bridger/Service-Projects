import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { createCategory, renameCategory, deleteCategories, setEventCategory } = await import("../categories");

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

describe("deleteCategories", () => {
  it("rejects a non-staff caller", async () => {
    const result = await deleteCategories(VOLUNTEER, "org-1", ["cat-1"]);
    expect(result.deleted).toBe(0);
    expect(prismaMock.category.updateMany).not.toHaveBeenCalled();
  });

  it("soft-deletes (sets deletedAt) scoped to the caller's org", async () => {
    await deleteCategories(ADMIN, "org-1", ["cat-1", "cat-2"]);
    expect(prismaMock.category.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cat-1", "cat-2"] }, orgId: "org-1" },
      data: { deletedAt: expect.any(Date) },
    });
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
