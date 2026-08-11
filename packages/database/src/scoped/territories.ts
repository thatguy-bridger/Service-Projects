import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

// GeoJSON-shaped, matching the `polygon Json` column -- SPEC.md §5.1's
// Territory model. Not validated beyond "has a coordinates array with 3+
// points" (createTerritory below); the map component is the only writer.
export interface TerritoryPolygon {
  type: "Polygon";
  coordinates: [[number, number][]];
}

export interface TerritoryRow {
  id: string;
  name: string;
  polygon: TerritoryPolygon;
  addressPointCount: number | null;
  lastFilledAt: string | null;
  createdAt: string;
}

export async function territoriesForOrg(
  session: SessionLike | null | undefined,
  orgId: string
): Promise<TerritoryRow[]> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];

  const territories = await prisma.territory.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return territories.map((t) => ({
    id: t.id,
    name: t.name,
    polygon: t.polygon as unknown as TerritoryPolygon,
    addressPointCount: t.addressPointCount,
    lastFilledAt: t.lastFilledAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));
}

export interface TerritoryActionResult {
  ok: boolean;
  error?: string;
  territoryId?: string;
}

export async function createTerritory(
  session: SessionLike | null | undefined,
  orgId: string,
  name: string,
  polygon: TerritoryPolygon
): Promise<TerritoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  if (!polygon?.coordinates?.[0] || polygon.coordinates[0].length < 3) {
    return { ok: false, error: "A territory needs at least 3 points." };
  }

  const territory = await prisma.territory.create({
    data: { orgId, name: trimmed, polygon: polygon as object },
  });
  return { ok: true, territoryId: territory.id };
}

export async function renameTerritory(
  session: SessionLike | null | undefined,
  orgId: string,
  territoryId: string,
  name: string
): Promise<TerritoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  const result = await prisma.territory.updateMany({
    where: { id: territoryId, orgId, deletedAt: null },
    data: { name: trimmed },
  });
  if (result.count === 0) return { ok: false, error: "Territory not found." };
  return { ok: true };
}

/**
 * Replaces a territory's saved shape (the map editor's "drag/add/delete
 * points, then save" flow). Clears addressPointCount/lastFilledAt back
 * to null rather than leaving the old count in place -- a cached count
 * is only meaningful for the shape it was computed against, and once
 * the shape moves it's actively misleading until re-checked, not just
 * stale.
 */
export async function updateTerritoryShape(
  session: SessionLike | null | undefined,
  orgId: string,
  territoryId: string,
  polygon: TerritoryPolygon
): Promise<TerritoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  if (!polygon?.coordinates?.[0] || polygon.coordinates[0].length < 3) {
    return { ok: false, error: "A territory needs at least 3 points." };
  }

  const result = await prisma.territory.updateMany({
    where: { id: territoryId, orgId, deletedAt: null },
    data: { polygon: polygon as object, addressPointCount: null, lastFilledAt: null },
  });
  if (result.count === 0) return { ok: false, error: "Territory not found." };
  return { ok: true };
}

export async function deleteTerritory(
  session: SessionLike | null | undefined,
  orgId: string,
  territoryId: string
): Promise<TerritoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.territory.updateMany({
    where: { id: territoryId, orgId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) return { ok: false, error: "Territory not found." };
  return { ok: true };
}

export interface AddressPointPin {
  lat: number;
  lng: number;
  fullAddress: string;
}

export interface AddressPointBoundsResult {
  points: AddressPointPin[];
  truncated: boolean;
}

// How many pins to hand back for one viewport -- rendering every
// imported address as a Marker gets slow well before a city's worth of
// points would fit on screen anyway, and the caller (TerritoryDrawer)
// only calls this once the map is zoomed in enough that a real
// viewport rarely holds more than this many addresses to begin with.
const BOUNDS_PIN_LIMIT = 500;

/**
 * Addresses inside a lat/lng box, for showing imported address points as
 * pins on the territory map once the admin is zoomed in enough that
 * plotting every point wouldn't just turn the map into a smear of dots.
 * Not org-scoped, same as the rest of AddressPoint -- it's shared
 * reference geodata, not per-org data.
 */
export async function addressPointsInBounds(
  session: SessionLike | null | undefined,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): Promise<AddressPointBoundsResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { points: [], truncated: false };

  const rows = await prisma.addressPoint.findMany({
    where: {
      lat: { gte: bounds.minLat, lte: bounds.maxLat },
      lng: { gte: bounds.minLng, lte: bounds.maxLng },
    },
    select: { lat: true, lng: true, fullAddress: true },
    take: BOUNDS_PIN_LIMIT + 1,
  });

  const truncated = rows.length > BOUNDS_PIN_LIMIT;
  return { points: rows.slice(0, BOUNDS_PIN_LIMIT), truncated };
}

export interface TerritoryFillResult {
  ok: boolean;
  error?: string;
  count?: number;
}

async function countAddressPointsInPolygon(polygon: unknown): Promise<number> {
  const polygonJson = JSON.stringify(polygon);
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "AddressPoint"
    WHERE ST_Contains(
      ST_SetSRID(ST_GeomFromGeoJSON(${polygonJson}), 4326),
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * SPEC.md §9.2's fill step, against a local import instead of a live
 * UGRC call ("ST_Contains against a local import... a live API call per
 * polygon fill is slower, rate-limited, and no fresher"). Counts
 * AddressPoint rows inside the territory's saved polygon and caches the
 * result on the Territory itself (addressPointCount/lastFilledAt) so the
 * list view doesn't need to re-run this query just to display a number.
 * Every AddressPoint from every imported source is considered -- there's
 * no per-territory source filter, since a territory could legitimately
 * span address points imported from more than one county/batch.
 */
export async function previewTerritoryFill(
  session: SessionLike | null | undefined,
  orgId: string,
  territoryId: string
): Promise<TerritoryFillResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const territory = await prisma.territory.findFirst({ where: { id: territoryId, orgId, deletedAt: null } });
  if (!territory) return { ok: false, error: "Territory not found." };

  const count = await countAddressPointsInPolygon(territory.polygon);

  await prisma.territory.update({
    where: { id: territoryId },
    data: { addressPointCount: count, lastFilledAt: new Date() },
  });

  return { ok: true, count };
}

/**
 * Same count, but against a polygon that hasn't been saved as a
 * Territory yet -- lets the drawing UI show "N addresses in this shape
 * so far" as a lightweight card while an admin is still drawing, without
 * forcing them to save first just to see whether the shape is even
 * useful. Read-only, nothing cached (there's no Territory row to cache
 * it on).
 */
export async function previewPolygonFill(
  session: SessionLike | null | undefined,
  polygon: TerritoryPolygon
): Promise<TerritoryFillResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  if (!polygon?.coordinates?.[0] || polygon.coordinates[0].length < 3) {
    return { ok: false, error: "A shape needs at least 3 points." };
  }

  const count = await countAddressPointsInPolygon(polygon);
  return { ok: true, count };
}
