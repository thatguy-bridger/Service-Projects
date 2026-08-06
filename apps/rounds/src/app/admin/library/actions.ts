"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventForSession,
  copyHouseholdsToEvent,
  deleteHouseholds,
  updateHousehold,
  createHouseholdAdmin,
  type CopyToEventResult,
  type DeleteResult,
  type UpdateHouseholdResult,
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

  const result = await copyHouseholdsToEvent(session, {
    orgId: org.id,
    eventId: event.id,
    categoryId: event.categoryId,
    amountCents: event.priceCents,
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

// DataTable-compatible variants (plain args, not FormData).

export async function saveHouseholdRowAction(
  householdId: string,
  patch: Record<string, string>
): Promise<UpdateHouseholdResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await updateHousehold(session, org.id, householdId, {
    contactName: patch.contactName,
    contactEmail: patch.contactEmail || null,
    contactPhone: patch.contactPhone || null,
    addressInput: patch.addressInput,
    placementNote: patch.placementNote || null,
    accessNotes: patch.accessNotes || null,
  });
  revalidatePath("/admin/library");
  return result;
}

export async function deleteHouseholdsRowsAction(householdIds: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { deleted: 0 };
  const result = await deleteHouseholds(session, org.id, householdIds);
  revalidatePath("/admin/library");
  return { deleted: result.deleted };
}

export async function addHouseholdAction(values: Record<string, string>): Promise<UpdateHouseholdResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await createHouseholdAdmin(session, org.id, {
    contactName: values.contactName ?? "",
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
    addressInput: values.addressInput ?? "",
  });
  revalidatePath("/admin/library");
  return result;
}

export async function copyToEventBySelection(eventId: string, householdIds: string[]): Promise<CopyToEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  if (!eventId) return { copied: 0, error: "Choose an event to copy into." };
  if (householdIds.length === 0) return { copied: 0, error: "Select at least one household." };

  const org = await defaultOrganization();
  if (!org) return { copied: 0, error: "No organization set up yet." };

  const event = await eventForSession(session, org.id, eventId);
  if (!event) return { copied: 0, error: "Event not found." };

  const result = await copyHouseholdsToEvent(session, {
    orgId: org.id,
    eventId: event.id,
    categoryId: event.categoryId,
    amountCents: event.priceCents,
    householdIds,
  });

  revalidatePath(`/admin/events/${eventId}`);
  return result;
}
