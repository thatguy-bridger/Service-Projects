"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { defaultOrganization, setCopyOverride, type CopyOverrideActionResult } from "@service-projects/database";

export async function setCopyOverrideAction(key: string, value: string): Promise<CopyOverrideActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await setCopyOverride(session, org.id, key, value);
  revalidatePath("/admin/copy");
  return result;
}
