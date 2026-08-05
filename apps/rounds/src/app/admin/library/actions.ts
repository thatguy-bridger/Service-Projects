"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventForSession,
  seasonById,
  copyHouseholdsToEvent,
  deleteHouseholds,
  type CopyToEventResult,
  type DeleteResult,
} from "@service-projects/database";

export async function copyToEvent(
  _prevState: CopyToEventResult,
  formData: FormData
): Promise<CopyToEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const eventId = String(formData.get("eventId") ?? "");
  const householdIds = formData.getAll("householdIds").map(String);

  if (!eventId) return { copied: 0, error: "Choose an event to copy into." };
  if (householdIds.length === 0) return { copied: 0, error: "Select at least one household." };

  const org = await defaultOrganization();
  if (!org) return { copied: 0, error: "No organization set up yet." };

  const event = await eventForSession(session, org.id, eventId);
  if (!event) return { copied: 0, error: "Event not found." };
  if (!event.seasonId) {
    return { copied: 0, error: "That event has no season, so it doesn't use the household/subscription model yet." };
  }

  const season = await seasonById(event.seasonId);
  const amountCents = season && season.pricingMode === "per_holiday" ? season.priceCents : 0;

  const result = await copyHouseholdsToEvent(session, {
    orgId: org.id,
    eventId: event.id,
    seasonId: event.seasonId,
    amountCents,
    householdIds,
  });

  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function deleteHouseholdsAction(
  _prevState: DeleteResult,
  formData: FormData
): Promise<DeleteResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const householdIds = formData.getAll("householdIds").map(String);
  if (householdIds.length === 0) {
    return { deleted: 0, errors: [{ id: "", reason: "Select at least one household." }] };
  }

  const org = await defaultOrganization();
  if (!org) return { deleted: 0, errors: [{ id: "", reason: "No organization set up yet." }] };

  const result = await deleteHouseholds(session, org.id, householdIds);
  revalidatePath("/admin/library");
  return result;
}
