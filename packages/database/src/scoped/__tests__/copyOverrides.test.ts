import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { copyOverridesForOrg, setCopyOverride } = await import("../copyOverrides");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.membership.findFirst.mockResolvedValue(null);
});

const ADMIN = { user: { id: "u-admin", role: "ADMIN" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("copyOverridesForOrg", () => {
  it("is public -- no session required -- and returns a key/value map", async () => {
    prismaMock.uiCopyOverride.findMany.mockResolvedValueOnce([
      { key: "signup.holidays.title", value: "Pick your holidays" },
      { key: "brand.name", value: "Custom Org" },
    ]);
    const result = await copyOverridesForOrg("org-1");
    expect(result).toEqual({ "signup.holidays.title": "Pick your holidays", "brand.name": "Custom Org" });
    expect(prismaMock.uiCopyOverride.findMany).toHaveBeenCalledWith({ where: { orgId: "org-1" } });
  });

  it("returns an empty object when nothing is overridden", async () => {
    const result = await copyOverridesForOrg("org-1");
    expect(result).toEqual({});
  });
});

describe("setCopyOverride", () => {
  it("rejects a non-staff caller", async () => {
    const result = await setCopyOverride(VOLUNTEER, "org-1", "brand.name", "New name");
    expect(result.ok).toBe(false);
    expect(prismaMock.uiCopyOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an empty key", async () => {
    const result = await setCopyOverride(ADMIN, "org-1", "   ", "value");
    expect(result.ok).toBe(false);
    expect(prismaMock.uiCopyOverride.upsert).not.toHaveBeenCalled();
  });

  it("upserts a non-blank value, scoped to the org and key", async () => {
    const result = await setCopyOverride(ADMIN, "org-1", "brand.name", "Custom Org");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.uiCopyOverride.upsert).toHaveBeenCalledWith({
      where: { orgId_key: { orgId: "org-1", key: "brand.name" } },
      create: { orgId: "org-1", key: "brand.name", value: "Custom Org", updatedBy: "u-admin" },
      update: { value: "Custom Org", updatedBy: "u-admin" },
    });
  });

  it("deletes the override instead of storing a blank value", async () => {
    const result = await setCopyOverride(ADMIN, "org-1", "brand.name", "   ");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.uiCopyOverride.deleteMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", key: "brand.name" },
    });
    expect(prismaMock.uiCopyOverride.upsert).not.toHaveBeenCalled();
  });
});
