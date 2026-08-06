"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { defaultOrganization, updateHousehold, type UpdateHouseholdResult } from "@service-projects/database";

export async function updateHouseholdAction(
  householdId: string,
  _prevState: UpdateHouseholdResult,
  formData: FormData
): Promise<UpdateHouseholdResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const contactName = String(formData.get("contactName") ?? "").trim();
  if (!contactName) return { ok: false, error: "Name is required." };

  const result = await updateHousehold(session, org.id, householdId, {
    contactName,
    contactEmail: String(formData.get("contactEmail") ?? "").trim() || null,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    addressInput: String(formData.get("addressInput") ?? "").trim(),
    placementNote: String(formData.get("placementNote") ?? "").trim() || null,
    accessNotes: String(formData.get("accessNotes") ?? "").trim() || null,
    // An admin editing this record from the review queue (or anywhere
    // else) and saving it IS the review — clears whatever flagged it,
    // so fixing an address here is enough; no separate "mark reviewed"
    // step needed on top of a save that already changed the thing that
    // needed checking.
    needsReview: false,
    needsReviewReason: null,
  });

  revalidatePath("/admin/library");
  revalidatePath(`/admin/library/${householdId}`);
  return result;
}
