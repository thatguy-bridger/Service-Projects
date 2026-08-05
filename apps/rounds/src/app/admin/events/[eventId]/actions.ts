"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventForSession,
  importHouseholdsForEvent,
  type ImportResult,
} from "@service-projects/database";

export async function importEventCsv(
  eventId: string,
  _prevState: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { imported: 0, errors: [{ row: 0, reason: "Choose a CSV file." }] };
  }

  const org = await defaultOrganization();
  if (!org) return { imported: 0, errors: [{ row: 0, reason: "No organization set up yet." }] };

  const event = await eventForSession(session, org.id, eventId);
  if (!event) return { imported: 0, errors: [{ row: 0, reason: "Event not found." }] };

  // Subscription/Household is the flag-season signup model — an event
  // with no season (a custom fundraiser/flyer/etc created via "Create a
  // custom event") doesn't have this data shape to import into yet.
  if (!event.seasonId) {
    return {
      imported: 0,
      errors: [
        {
          row: 0,
          reason:
            "This event has no season, so it doesn't use the household/subscription model — import isn't available for it yet.",
        },
      ],
    };
  }

  const csvText = await file.text();
  const result = await importHouseholdsForEvent(session, {
    orgId: org.id,
    seasonId: event.seasonId,
    eventId: event.id,
    csvText,
  });

  revalidatePath(`/admin/events/${eventId}`);
  return result;
}
