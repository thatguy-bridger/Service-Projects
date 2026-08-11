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

type AddressPointDraft = { lat: number; lng: number; fullAddress: string; city: string | null; zip: string | null };

function parseCsvAddressPoints(text: string): { rows: AddressPointDraft[]; skipped: number } {
  const rows: AddressPointDraft[] = [];
  let skipped = 0;

  for (const row of parseCsvRows(text)) {
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

    rows.push({
      lat,
      lng,
      fullAddress: fullAddress.trim(),
      city: findColumn(row, ["CITY"]) ?? null,
      zip: findColumn(row, ["POSTCODE", "ZIP", "ZIPCODE"]) ?? null,
    });
  }

  return { rows, skipped };
}

interface GeoJsonFeatureLike {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
}

function stringProp(properties: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = properties?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

// OpenAddresses.io's actual distribution format is newline-delimited
// GeoJSON (one Feature object per line: {"type":"Feature","properties":
// {"number":...,"street":...,"city":...,"postcode":...},"geometry":
// {"type":"Point","coordinates":[lng,lat]}}), not the CSV this was
// originally built for -- their CSV export is a secondary/derived
// format. Parsed independently per line so one malformed line just gets
// skipped rather than failing the whole file.
function parseNdjsonAddressPoints(text: string): { rows: AddressPointDraft[]; skipped: number } {
  const rows: AddressPointDraft[] = [];
  let skipped = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let feature: GeoJsonFeatureLike;
    try {
      feature = JSON.parse(trimmedLine);
    } catch {
      skipped++;
      continue;
    }

    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      skipped++;
      continue;
    }
    const [lng, lat] = coordinates;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }

    const properties = feature.properties;
    const directAddress = stringProp(properties, "address") ?? stringProp(properties, "full_address");
    let fullAddress = directAddress;
    if (!fullAddress) {
      const number = stringProp(properties, "number");
      const street = stringProp(properties, "street");
      const unit = stringProp(properties, "unit");
      fullAddress = [number, street].filter(Boolean).join(" ") + (unit ? ` ${unit}` : "");
    }
    if (!fullAddress?.trim()) {
      skipped++;
      continue;
    }

    rows.push({
      lat,
      lng,
      fullAddress: fullAddress.trim(),
      city: stringProp(properties, "city") ?? null,
      zip: stringProp(properties, "postcode") ?? stringProp(properties, "zip") ?? null,
    });
  }

  return { rows, skipped };
}

export interface ImportAddressPointsResult {
  ok: boolean;
  error?: string;
  imported: number;
  skipped: number;
}

/**
 * Accepts either a CSV (header row + LAT/LON-style columns) or
 * newline-delimited GeoJSON (OpenAddresses.io's real export format,
 * one Feature per line) -- detected by whether the first non-blank
 * line looks like JSON, no format flag needed from the caller.
 *
 * Replaces an entire `source` batch in one go: every existing row
 * tagged with this source is deleted, then every valid row from the
 * new file is inserted. That's the whole "refresh" mechanism SPEC.md
 * §9.2 asks for ("refresh quarterly") -- re-import the same source
 * label with a fresh export and the old batch is gone. Different
 * counties/exports get different source labels and coexist;
 * re-importing one never touches another.
 */
export async function importAddressPointsCsv(
  session: SessionLike | null | undefined,
  fileText: string,
  source: string
): Promise<ImportAddressPointsResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) {
    return { ok: false, error: "Forbidden", imported: 0, skipped: 0 };
  }
  const trimmedSource = source.trim();
  if (!trimmedSource) return { ok: false, error: "A source label is required.", imported: 0, skipped: 0 };

  const firstLine = fileText.trimStart().slice(0, 1);
  const { rows: toInsert, skipped } =
    firstLine === "{" ? parseNdjsonAddressPoints(fileText) : parseCsvAddressPoints(fileText);

  if (toInsert.length === 0 && skipped === 0) {
    return { ok: false, error: "No rows found in that file.", imported: 0, skipped: 0 };
  }
  if (toInsert.length === 0) {
    return { ok: false, error: "No valid rows to import — check the lat/lng data.", imported: 0, skipped };
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
