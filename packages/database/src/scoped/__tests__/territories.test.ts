import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";
import type { TerritoryPolygon } from "../territories";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { territoriesForOrg, createTerritory, renameTerritory, deleteTerritory, previewTerritoryFill } = await import(
  "../territories"
);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.membership.findFirst.mockResolvedValue(null);
});

const ADMIN = { user: { id: "u-admin", role: "ADMIN" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

const SQUARE: TerritoryPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-111.9, 40.7],
      [-111.8, 40.7],
      [-111.8, 40.6],
      [-111.9, 40.6],
    ],
  ],
};

describe("territoriesForOrg", () => {
  it("returns nothing for a non-staff caller, without querying", async () => {
    const result = await territoriesForOrg(VOLUNTEER, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.territory.findMany).not.toHaveBeenCalled();
  });

  it("scopes the read to the caller's org and live rows", async () => {
    await territoriesForOrg(ADMIN, "org-1");
    expect(prismaMock.territory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-1", deletedAt: null } })
    );
  });
});

describe("createTerritory", () => {
  it("rejects a non-staff caller before any write", async () => {
    const result = await createTerritory(VOLUNTEER, "org-1", "North side", SQUARE);
    expect(result.ok).toBe(false);
    expect(prismaMock.territory.create).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const result = await createTerritory(ADMIN, "org-1", "   ", SQUARE);
    expect(result.ok).toBe(false);
    expect(prismaMock.territory.create).not.toHaveBeenCalled();
  });

  it("rejects a polygon with fewer than 3 points", async () => {
    const result = await createTerritory(ADMIN, "org-1", "Sliver", {
      type: "Polygon",
      coordinates: [[[-111.9, 40.7], [-111.8, 40.7]]],
    });
    expect(result.ok).toBe(false);
    expect(prismaMock.territory.create).not.toHaveBeenCalled();
  });

  it("staff can save a territory, scoped to their org", async () => {
    const result = await createTerritory(ADMIN, "org-1", "North side", SQUARE);
    expect(result.ok).toBe(true);
    expect(prismaMock.territory.create).toHaveBeenCalledWith({
      data: { orgId: "org-1", name: "North side", polygon: SQUARE },
    });
  });
});

describe("renameTerritory", () => {
  it("rejects a non-staff caller", async () => {
    const result = await renameTerritory(VOLUNTEER, "org-1", "terr-1", "New name");
    expect(result.ok).toBe(false);
    expect(prismaMock.territory.updateMany).not.toHaveBeenCalled();
  });

  it("scopes the update to the caller's org and this territory", async () => {
    await renameTerritory(ADMIN, "org-1", "terr-1", "New name");
    expect(prismaMock.territory.updateMany).toHaveBeenCalledWith({
      where: { id: "terr-1", orgId: "org-1", deletedAt: null },
      data: { name: "New name" },
    });
  });

  it("reports not-found when nothing in this org matches", async () => {
    prismaMock.territory.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await renameTerritory(ADMIN, "org-1", "terr-missing", "New name");
    expect(result).toEqual({ ok: false, error: "Territory not found." });
  });
});

describe("previewTerritoryFill", () => {
  it("rejects a non-staff caller", async () => {
    const result = await previewTerritoryFill(VOLUNTEER, "org-1", "terr-1");
    expect(result.ok).toBe(false);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports not-found when the territory doesn't exist in this org", async () => {
    const result = await previewTerritoryFill(ADMIN, "org-1", "terr-missing");
    expect(result).toEqual({ ok: false, error: "Territory not found." });
  });

  it("counts address points inside the polygon and caches the result on the territory", async () => {
    prismaMock.territory.findFirst.mockResolvedValueOnce({ id: "terr-1", orgId: "org-1", polygon: SQUARE });
    prismaMock.$queryRaw.mockResolvedValueOnce([{ count: 1847n }]);
    const result = await previewTerritoryFill(ADMIN, "org-1", "terr-1");
    expect(result).toEqual({ ok: true, count: 1847 });
    expect(prismaMock.territory.update).toHaveBeenCalledWith({
      where: { id: "terr-1" },
      data: { addressPointCount: 1847, lastFilledAt: expect.any(Date) },
    });
  });
});

describe("deleteTerritory", () => {
  it("rejects a non-staff caller", async () => {
    const result = await deleteTerritory(VOLUNTEER, "org-1", "terr-1");
    expect(result.ok).toBe(false);
    expect(prismaMock.territory.updateMany).not.toHaveBeenCalled();
  });

  it("soft-deletes (sets deletedAt) scoped to the caller's org", async () => {
    await deleteTerritory(ADMIN, "org-1", "terr-1");
    expect(prismaMock.territory.updateMany).toHaveBeenCalledWith({
      where: { id: "terr-1", orgId: "org-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
