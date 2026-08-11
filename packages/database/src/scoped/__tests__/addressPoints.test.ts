import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { importAddressPointsCsv, addressPointSources, deleteAddressPointSource } = await import("../addressPoints");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.membership.findFirst.mockResolvedValue(null);
});

const ADMIN = { user: { id: "u-admin", role: "ADMIN" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

const OPENADDRESSES_CSV =
  "LON,LAT,NUMBER,STREET,UNIT,CITY,DISTRICT,REGION,POSTCODE,ID,HASH\n" +
  "-111.891,40.7608,350,State St,,Salt Lake City,,UT,84103,1,abc\n" +
  "-111.89,40.76,352,State St,,Salt Lake City,,UT,84103,2,def\n";

describe("importAddressPointsCsv", () => {
  it("rejects a non-staff caller before touching the database", async () => {
    const result = await importAddressPointsCsv(VOLUNTEER, OPENADDRESSES_CSV, "Salt Lake County");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an empty source label", async () => {
    const result = await importAddressPointsCsv(ADMIN, OPENADDRESSES_CSV, "   ");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects empty CSV text", async () => {
    const result = await importAddressPointsCsv(ADMIN, "", "Salt Lake County");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("parses OpenAddresses.io's standard NUMBER/STREET columns into a composed address, replacing the source in one transaction", async () => {
    const result = await importAddressPointsCsv(ADMIN, OPENADDRESSES_CSV, "Salt Lake County 2027-Q1");
    expect(result).toEqual({ ok: true, imported: 2, skipped: 0 });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      expect.anything(), // deleteMany
      expect.anything(), // createMany
    ]);
    expect(prismaMock.addressPoint.deleteMany).toHaveBeenCalledWith({
      where: { source: "Salt Lake County 2027-Q1" },
    });
    expect(prismaMock.addressPoint.createMany).toHaveBeenCalledWith({
      data: [
        { lat: 40.7608, lng: -111.891, fullAddress: "350 State St", city: "Salt Lake City", zip: "84103", source: "Salt Lake County 2027-Q1" },
        { lat: 40.76, lng: -111.89, fullAddress: "352 State St", city: "Salt Lake City", zip: "84103", source: "Salt Lake County 2027-Q1" },
      ],
    });
  });

  it("accepts a single ADDRESS column instead of NUMBER+STREET", async () => {
    const csv = "LAT,LON,ADDRESS,CITY\n40.7,-111.9,123 Main St,Sandy\n";
    const result = await importAddressPointsCsv(ADMIN, csv, "Sandy export");
    expect(result).toEqual({ ok: true, imported: 1, skipped: 0 });
    expect(prismaMock.addressPoint.createMany).toHaveBeenCalledWith({
      data: [{ lat: 40.7, lng: -111.9, fullAddress: "123 Main St", city: "Sandy", zip: null, source: "Sandy export" }],
    });
  });

  it("skips rows with missing/invalid lat or lng instead of failing the whole import", async () => {
    const csv = "LAT,LON,ADDRESS\n40.7,-111.9,123 Main St\nnot-a-number,-111.9,456 Main St\n";
    const result = await importAddressPointsCsv(ADMIN, csv, "Test");
    expect(result).toEqual({ ok: true, imported: 1, skipped: 1 });
  });

  it("reports failure when every row is invalid", async () => {
    const csv = "LAT,LON,ADDRESS\nbad,bad,123 Main St\n";
    const result = await importAddressPointsCsv(ADMIN, csv, "Test");
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("addressPointSources", () => {
  it("returns nothing for a non-staff caller", async () => {
    const result = await addressPointSources(VOLUNTEER);
    expect(result).toEqual([]);
    expect(prismaMock.addressPoint.groupBy).not.toHaveBeenCalled();
  });

  it("groups by source for staff", async () => {
    prismaMock.addressPoint.groupBy.mockResolvedValueOnce([
      { source: "Salt Lake County", _count: { _all: 42 }, _max: { importedAt: new Date("2027-01-01") } },
    ]);
    const result = await addressPointSources(ADMIN);
    expect(result).toEqual([
      { source: "Salt Lake County", count: 42, importedAt: new Date("2027-01-01").toISOString() },
    ]);
  });
});

describe("deleteAddressPointSource", () => {
  it("rejects a non-staff caller", async () => {
    const result = await deleteAddressPointSource(VOLUNTEER, "Salt Lake County");
    expect(result.ok).toBe(false);
    expect(prismaMock.addressPoint.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes every row for that source", async () => {
    prismaMock.addressPoint.deleteMany.mockResolvedValueOnce({ count: 42 });
    const result = await deleteAddressPointSource(ADMIN, "Salt Lake County");
    expect(result).toEqual({ ok: true, deleted: 42 });
    expect(prismaMock.addressPoint.deleteMany).toHaveBeenCalledWith({ where: { source: "Salt Lake County" } });
  });
});
