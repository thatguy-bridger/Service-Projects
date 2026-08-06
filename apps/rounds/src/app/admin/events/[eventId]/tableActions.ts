"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  updateSignupForEvent,
  removeHouseholdsFromEvent,
  importHouseholdsForEvent,
  updateEvent,
  deleteEvents,
  setEventCategory,
  type SubStatus,
  type EventStatus,
  type ImportResult,
} from "@service-projects/database";

// DataTable's onSaveRow/onDeleteSelected/onImportCsv all take plain
// arguments (not FormData) so a table stays reusable outside a <form>
// element -- these wrap the same underlying scoped helpers the
// FormData-based actions in ./actions.ts already use.

export async function saveSignupRowAction(
  eventId: string,
  subscriptionEventId: string,
  patch: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const result = await updateSignupForEvent(session, eventId, subscriptionEventId, {
    contactName: patch.contactName,
    contactEmail: patch.contactEmail,
    contactPhone: patch.contactPhone,
    addressInput: patch.addressInput,
    placementNote: patch.placementNote,
    accessNotes: patch.accessNotes,
    subscriptionStatus: patch.subscriptionStatus as SubStatus | undefined,
    amountCents: patch.amountCents ? Math.round(Number(patch.amountCents) * 100) : undefined,
    skipped: patch.skipped === undefined ? undefined : patch.skipped === "yes",
  });
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function deleteSignupsAction(eventId: string, subscriptionEventIds: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  const result = await removeHouseholdsFromEvent(session, eventId, subscriptionEventIds);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function importSignupsCsvAction(eventId: string, seasonId: string, csvText: string): Promise<ImportResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { imported: 0, errors: [{ row: 0, reason: "No organization." }] };
  const result = await importHouseholdsForEvent(session, { orgId: org.id, seasonId, eventId, csvText });
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function saveEventDatesRowAction(
  eventId: string,
  _id: string,
  patch: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };

  const serviceStartsAt = patch.serviceStartsAt ? new Date(patch.serviceStartsAt) : undefined;
  const serviceEndsAt = patch.serviceEndsAt ? new Date(patch.serviceEndsAt) : undefined;
  if ((patch.serviceStartsAt && Number.isNaN(serviceStartsAt?.getTime())) || (patch.serviceEndsAt && Number.isNaN(serviceEndsAt?.getTime()))) {
    return { ok: false, error: "Enter valid dates." };
  }

  const result = await updateEvent(session, org.id, eventId, {
    name: patch.name,
    status: patch.status as EventStatus | undefined,
    serviceStartsAt,
    serviceEndsAt,
  });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  return result;
}

export async function deleteEventAction(eventId: string): Promise<{ ok: boolean }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false };
  const result = await deleteEvents(session, org.id, [eventId]);
  revalidatePath("/admin/events");
  return { ok: result.deleted > 0 };
}

export async function setEventCategoryAction(eventId: string, categoryId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await setEventCategory(session, org.id, eventId, categoryId || null);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  return result;
}
