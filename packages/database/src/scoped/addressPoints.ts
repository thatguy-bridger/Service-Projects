import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";
import { parseCsvRows } from "../csv";

// Case-insensitive header lookup, first match wins -- different address-
// point exports name columns differently (OpenAddresses.io's standard
// header is LON,LAT,NUMBER,STREET,UNIT,CITY,DISTRICT,REGION,POSTCODE,
// ID,HASH; other county/state exports vary), and "expandable to more
// files" means not hardcoding one exact header shape.
function findColumn(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const key = keys.find((k) => k.toLowerCase() === candidate.toLowerCase());
    if (key && row[key]) return row[key];
  }
  return undefined;
}

export interface ImportAddressPointsResult {
  ok: boolean;
  error?: string;
  imported: number;
  skipped: number;
}

/**
 * Replaces an entire `source` batch in one go: every existing row tagged
 * with this source is deleted, then every valid row from the new CSV is
 * inserted. That's the whole "refresh" mechanism SPEC.md §9.2 asks for
 * ("refresh quarterly") -- re-import the same source label with a fresh
 * export and the old batch is gone. Different counties/exports get
 * different source labels and coexist; re-importing one never touches
 * another.
 */
export async function importAddressPointsCsv(
  session: SessionLike | null | undefined,
  csvText: string,
  source: string
): Promise<ImportAddressPointsResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) {
    return { ok: false, error: "Forbidden", imported: 0, skipped: 0 };
  }
  const trimmedSource = source.trim();
  if (!trimmedSource) return { ok: false, error: "A source label is required.", imported: 0, skipped: 0 };

  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return { ok: false, error: "No rows found in that CSV.", imported: 0, skipped: 0 };

  const toInsert: { lat: number; lng: number; fullAddress: string; city: string | null; zip: string | null }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const latRaw = findColumn(row, ["LAT", "LATITUDE", "Y"]);
    const lngRaw = findColumn(row, ["LON", "LONG", "LONGITUDE", "X"]);
    const lat = latRaw !== undefined ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined ? Number(lngRaw) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }

    const directAddress = findColumn(row, ["ADDRESS", "FULL_ADDRESS", "FULLADDRESS"]);
    let fullAddress = directAddress;
    if (!fullAddress) {
      const number = findColumn(row, ["NUMBER", "HOUSE_NUMBER"]);
      const street = findColumn(row, ["STREET", "STREET_NAME"]);
      const unit = findColumn(row, ["UNIT"]);
      fullAddress = [number, street].filter(Boolean).join(" ") + (unit ? ` ${unit}` : "");
    }
    if (!fullAddress?.trim()) {
      skipped++;
      continue;
    }

    toInsert.push({
      lat,
      lng,
      fullAddress: fullAddress.trim(),
      city: findColumn(row, ["CITY"]) ?? null,
      zip: findColumn(row, ["POSTCODE", "ZIP", "ZIPCODE"]) ?? null,
    });
  }

  if (toInsert.length === 0) {
    return { ok: false, error: "No valid rows to import — check the lat/lng columns.", imported: 0, skipped };
  }

  await prisma.$transaction([
    prisma.addressPoint.deleteMany({ where: { source: trimmedSource } }),
    prisma.addressPoint.createMany({
      data: toInsert.map((r) => ({ ...r, source: trimmedSource })),
    }),
  ]);

  return { ok: true, imported: toInsert.length, skipped };
}

export interface AddressPointSourceRow {
  source: string;
  count: number;
  importedAt: string;
}

export async function addressPointSources(
  session: SessionLike | null | undefined
): Promise<AddressPointSourceRow[]> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];

  const grouped = await prisma.addressPoint.groupBy({
    by: ["source"],
    _count: { _all: true },
    _max: { importedAt: true },
    orderBy: { source: "asc" },
  });
  return grouped.map((g) => ({
    source: g.source,
    count: g._count._all,
    importedAt: (g._max.importedAt ?? new Date()).toISOString(),
  }));
}

export async function deleteAddressPointSource(
  session: SessionLike | null | undefined,
  source: string
): Promise<{ ok: boolean; deleted: number }> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, deleted: 0 };
  const result = await prisma.addressPoint.deleteMany({ where: { source } });
  return { ok: true, deleted: result.count };
}
