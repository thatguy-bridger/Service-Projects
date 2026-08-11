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

// Real sample lines from an OpenAddresses.io ndgeojson export (Ephram, UT).
const OPENADDRESSES_NDJSON =
  '{"type": "Feature", "properties": {"hash": "2011240616ce1095", "number": "170", "street": "E 400 S", "unit": "", "city": "EPHRAIM", "district": "49039", "region": "UT", "postcode": "84627", "id": "EPHRAIM | 170 E 400 S", "accuracy": ""}, "geometry": {"type": "Point", "coordinates": [-111.582612, 39.3525121]}}\n' +
  '{"type": "Feature", "properties": {"hash": "ea57bf1817652eb2", "number": "64", "street": "W 100 N", "unit": "", "city": "EPHRAIM", "district": "49039", "region": "UT", "postcode": "84627", "id": "EPHRAIM | 64 W 100 N", "accuracy": ""}, "geometry": {"type": "Point", "coordinates": [-111.5886022, 39.3617725]}}\n';

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

  it("splits a large import into multiple createMany batches instead of one unbounded call", async () => {
    const header = "LAT,LON,ADDRESS\n";
    const rows = Array.from({ length: 5001 }, (_, i) => `40.7,-111.9,${i} Main St`).join("\n");
    const result = await importAddressPointsCsv(ADMIN, header + rows, "Big county");
    expect(result).toEqual({ ok: true, imported: 5001, skipped: 0 });
    // deleteMany + 2 batches (5000 + 1) for 5001 rows at a 5000-row batch size.
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      expect.anything(),
      expect.anything(),
      expect.anything(),
    ]);
    expect(prismaMock.addressPoint.createMany).toHaveBeenCalledTimes(2);
    const firstBatch = prismaMock.addressPoint.createMany.mock.calls[0][0].data;
    const secondBatch = prismaMock.addressPoint.createMany.mock.calls[1][0].data;
    expect(firstBatch).toHaveLength(5000);
    expect(secondBatch).toHaveLength(1);
  });
});

describe("importAddressPointsCsv — newline-delimited GeoJSON", () => {
  it("auto-detects and parses OpenAddresses.io's real ndgeojson export format", async () => {
    const result = await importAddressPointsCsv(ADMIN, OPENADDRESSES_NDJSON, "Sanpete County");
    expect(result).toEqual({ ok: true, imported: 2, skipped: 0 });
    expect(prismaMock.addressPoint.deleteMany).toHaveBeenCalledWith({ where: { source: "Sanpete County" } });
    expect(prismaMock.addressPoint.createMany).toHaveBeenCalledWith({
      data: [
        { lat: 39.3525121, lng: -111.582612, fullAddress: "170 E 400 S", city: "EPHRAIM", zip: "84627", source: "Sanpete County" },
        { lat: 39.3617725, lng: -111.5886022, fullAddress: "64 W 100 N", city: "EPHRAIM", zip: "84627", source: "Sanpete County" },
      ],
    });
  });

  it("skips a malformed line instead of failing the whole import", async () => {
    const ndjson = OPENADDRESSES_NDJSON + "not valid json\n";
    const result = await importAddressPointsCsv(ADMIN, ndjson, "Sanpete County");
    expect(result).toEqual({ ok: true, imported: 2, skipped: 1 });
  });

  it("skips a feature missing point coordinates", async () => {
    const ndjson = '{"type":"Feature","properties":{"number":"1","street":"Main St","city":"X","postcode":"1"},"geometry":{"type":"Point"}}\n';
    const result = await importAddressPointsCsv(ADMIN, ndjson, "Test");
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(1);
  });

  it("still requires a source label and staff role, same as the CSV path", async () => {
    const forbidden = await importAddressPointsCsv(VOLUNTEER, OPENADDRESSES_NDJSON, "Sanpete County");
    expect(forbidden.ok).toBe(false);

    const noSource = await importAddressPointsCsv(ADMIN, OPENADDRESSES_NDJSON, "  ");
    expect(noSource.ok).toBe(false);
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
