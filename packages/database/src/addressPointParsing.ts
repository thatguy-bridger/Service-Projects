import { parseCsvRows } from "./csv";

// Pure parsing, zero Prisma/DB dependency on purpose -- this module gets
// imported from the *browser* bundle too (AddressPointsClient.tsx parses
// a chosen file client-side so it can upload it in small batches with a
// real progress bar, instead of shipping one giant request body). Keep
// it that way: nothing here may import "../client" or anything else
// that pulls in @prisma/client, or the admin page's JS bundle would try
// to instantiate a Postgres client in the browser.

export interface AddressPointDraft {
  lat: number;
  lng: number;
  fullAddress: string;
  city: string | null;
  zip: string | null;
}

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

// Detects CSV vs newline-delimited GeoJSON by whether the first
// non-blank line looks like JSON, no format flag needed from the
// caller -- same logic on both the client (parsing before upload) and
// server (parsing a pasted/small import) sides.
export function parseAddressPoints(fileText: string): { rows: AddressPointDraft[]; skipped: number } {
  const firstLine = fileText.trimStart().slice(0, 1);
  return firstLine === "{" ? parseNdjsonAddressPoints(fileText) : parseCsvAddressPoints(fileText);
}
