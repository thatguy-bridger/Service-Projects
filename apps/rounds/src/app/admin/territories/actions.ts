"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  createTerritory,
  renameTerritory,
  updateTerritoryShape,
  deleteTerritory,
  previewTerritoryFill,
  previewPolygonFill,
  addressPointsInBounds,
  addressPointsInPolygon,
  signedUpHouseholdsInBounds,
  signedUpHouseholdsInPolygon,
  type TerritoryActionResult,
  type TerritoryFillResult,
  type TerritoryPolygon,
  type AddressPointBoundsResult,
  type SignedUpHouseholdPinsResult,
} from "@service-projects/database";

export async function createTerritoryAction(name: string, polygon: TerritoryPolygon): Promise<TerritoryActionResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await createTerritory(session, org.id, name, polygon);
  revalidatePath("/admin/territories");
  return result;
}

export async function renameTerritoryAction(id: string, name: string): Promise<TerritoryActionResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await renameTerritory(session, org.id, id, name);
  revalidatePath("/admin/territories");
  return result;
}

// Saves an edit to an existing territory's name + shape together (the
// editor always has both in hand at save time). Name and shape go
// through separate scoped helpers (renameTerritory / updateTerritoryShape
// already existed independently), run one after the other rather than
// merged into one DB call -- if the rename fails validation (blank name)
// the shape change is skipped too, so a partial save can't happen.
export async function updateTerritoryAction(
  id: string,
  name: string,
  polygon: TerritoryPolygon
): Promise<TerritoryActionResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };

  const renamed = await renameTerritory(session, org.id, id, name);
  if (!renamed.ok) {
    revalidatePath("/admin/territories");
    return renamed;
  }
  const result = await updateTerritoryShape(session, org.id, id, polygon);
  revalidatePath("/admin/territories");
  return result;
}

export async function deleteTerritoryAction(id: string): Promise<TerritoryActionResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await deleteTerritory(session, org.id, id);
  revalidatePath("/admin/territories");
  return result;
}

export async function previewTerritoryFillAction(id: string): Promise<TerritoryFillResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await previewTerritoryFill(session, org.id, id);
  revalidatePath("/admin/territories");
  return result;
}

// Read-only -- no org needed (nothing is scoped or written), so this
// works against an in-progress, unsaved shape while drawing.
export async function previewPolygonFillAction(polygon: TerritoryPolygon): Promise<TerritoryFillResult> {
  const session = await getServerSession(authOptions);
  return previewPolygonFill(session, polygon);
}

// Read-only, called from the map as the admin pans/zooms once they're
// close enough in to plot individual addresses -- no org needed.
export async function addressPointsInBoundsAction(bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): Promise<AddressPointBoundsResult> {
  const session = await getServerSession(authOptions);
  return addressPointsInBounds(session, bounds);
}

// Read-only, called while a territory is selected/being edited -- narrows
// the map down to that shape's own addresses instead of whatever the
// viewport happens to show, so it isn't limited by the zoom-gated bounds
// lookup above. No org needed.
export async function addressPointsInPolygonAction(polygon: TerritoryPolygon): Promise<AddressPointBoundsResult> {
  const session = await getServerSession(authOptions);
  return addressPointsInPolygon(session, polygon);
}

// Signed-up households (Household.lat/lng) are org-scoped, unlike
// AddressPoint -- needs defaultOrganization() the same way the rest of
// this file's org-scoped actions do.
export async function signedUpHouseholdsInBoundsAction(bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): Promise<SignedUpHouseholdPinsResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { points: [], truncated: false };
  return signedUpHouseholdsInBounds(session, org.id, bounds);
}

export async function signedUpHouseholdsInPolygonAction(polygon: TerritoryPolygon): Promise<SignedUpHouseholdPinsResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { points: [], truncated: false };
  return signedUpHouseholdsInPolygon(session, org.id, polygon);
}
