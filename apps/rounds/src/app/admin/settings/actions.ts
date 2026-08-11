"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  updateOrganization,
  updateAdminDashboardLayout,
  updatePublicFormLayout,
  type UpdateOrganizationResult,
} from "@service-projects/database";
import type { ScreenLayout } from "@service-projects/database/layoutBlocks";

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

  const emailFrom = String(formData.get("emailFrom") ?? "").trim();

  const result = await updateOrganization(org.id, { name, emailFrom: emailFrom || null });
  revalidatePath("/admin/settings");
  return result;
}

export async function updateAdminDashboardLayoutAction(
  layout: ScreenLayout
): Promise<UpdateOrganizationResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await updateAdminDashboardLayout(session, org.id, layout);
  revalidatePath("/admin/settings");
  revalidatePath("/");
  return result;
}

export async function updatePublicFormLayoutAction(layout: ScreenLayout): Promise<UpdateOrganizationResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await updatePublicFormLayout(session, org.id, layout);
  revalidatePath("/admin/settings");
  revalidatePath("/signup");
  return result;
}
