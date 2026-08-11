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

export interface TerritoryFillResult {
  ok: boolean;
  error?: string;
  count?: number;
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

  const polygonJson = JSON.stringify(territory.polygon);
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "AddressPoint"
    WHERE ST_Contains(
      ST_SetSRID(ST_GeomFromGeoJSON(${polygonJson}), 4326),
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  `;
  const count = Number(rows[0]?.count ?? 0);

  await prisma.territory.update({
    where: { id: territoryId },
    data: { addressPointCount: count, lastFilledAt: new Date() },
  });

  return { ok: true, count };
}
