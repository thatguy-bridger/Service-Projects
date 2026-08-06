"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { defaultOrganization, markHouseholdReviewed, markHouseholdsReviewedBulk } from "@service-projects/database";

export interface MarkReviewedActionResult {
  ok: boolean;
  error?: string;
}

export async function markReviewedAction(
  householdId: string,
  _prevState: MarkReviewedActionResult,
  _formData: FormData
): Promise<MarkReviewedActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN", "COORDINATOR"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await markHouseholdReviewed(session, org.id, householdId);
  revalidatePath("/admin/review");
  return result;
}

export async function markReviewedBulkAction(householdIds: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN", "COORDINATOR"]);
  const org = await defaultOrganization();
  if (!org) return { deleted: 0 };
  const result = await markHouseholdsReviewedBulk(session, org.id, householdIds);
  revalidatePath("/admin/review");
  return result;
}
