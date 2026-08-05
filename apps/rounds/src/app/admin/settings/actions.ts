"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  updateOrganization,
  updateSeason,
  type UpdateOrganizationResult,
  type UpdateSeasonResult,
} from "@service-projects/database";

export async function updateOrganizationAction(
  _prevState: UpdateOrganizationResult,
  formData: FormData
): Promise<UpdateOrganizationResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  const result = await updateOrganization(org.id, { name });
  revalidatePath("/admin/settings");
  return result;
}

export async function updateSeasonAction(
  seasonId: string,
  _prevState: UpdateSeasonResult,
  formData: FormData
): Promise<UpdateSeasonResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const name = String(formData.get("name") ?? "").trim();
  const priceCents = Math.round(Number(formData.get("priceDollars") ?? 0) * 100);
  if (!name) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(priceCents) || priceCents < 0) return { ok: false, error: "Enter a valid price." };

  const result = await updateSeason(org.id, seasonId, { name, priceCents });
  revalidatePath("/admin/settings");
  return result;
}
