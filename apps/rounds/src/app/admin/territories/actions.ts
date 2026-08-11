"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  createTerritory,
  renameTerritory,
  deleteTerritory,
  previewTerritoryFill,
  type TerritoryActionResult,
  type TerritoryFillResult,
  type TerritoryPolygon,
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
