"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { defaultOrganization, updateOrganization, type UpdateOrganizationResult } from "@service-projects/database";

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
