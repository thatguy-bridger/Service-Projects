"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { defaultOrganization, deleteEvents } from "@service-projects/database";

export interface DeleteEventsActionResult {
  deleted: number;
  error?: string;
}

export async function deleteEventsAction(
  _prevState: DeleteEventsActionResult,
  formData: FormData
): Promise<DeleteEventsActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const eventIds = formData.getAll("eventIds").map(String);
  if (eventIds.length === 0) return { deleted: 0, error: "Select at least one opportunity." };

  const org = await defaultOrganization();
  if (!org) return { deleted: 0, error: "No organization set up yet." };

  const result = await deleteEvents(session, org.id, eventIds);
  revalidatePath("/admin/events");
  return result;
}
