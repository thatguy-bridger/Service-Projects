"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventForSession,
  seasonById,
  importHouseholdsForEvent,
  addEventMembership,
  removeEventMembership,
  removeEventMemberships,
  removeHouseholdsFromEvent,
  copyHouseholdsToEvent,
  type ImportResult,
  type DeleteResult,
  type CopyToEventResult,
  type Role,
} from "@service-projects/database";

export interface MembershipActionResult {
  error?: string;
}

const EVENT_ROLES: Role[] = ["ADMIN", "COORDINATOR", "VOLUNTEER"];

export async function addEventPerson(
  eventId: string,
  _prevState: MembershipActionResult,
  formData: FormData
): Promise<MembershipActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { error: "No organization set up yet." };

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  if (!email || !EVENT_ROLES.includes(role)) {
    return { error: "Enter an email and pick a role." };
  }

  const result = await addEventMembership(session, {
    orgId: org.id,
    eventId,
    email,
    role,
    grantedBy: session?.user.id,
  });

  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function removeEventPerson(eventId: string, membershipId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  await removeEventMembership(session, eventId, membershipId);
  revalidatePath(`/admin/events/${eventId}`);
}

export interface RemovePeopleResult {
  removed: number;
  error?: string;
}

export async function removeEventPeopleBulk(
  eventId: string,
  _prevState: RemovePeopleResult,
  formData: FormData
): Promise<RemovePeopleResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const membershipIds = formData.getAll("membershipIds").map(String);
  if (membershipIds.length === 0) return { removed: 0, error: "Select at least one person." };

  const result = await removeEventMemberships(session, eventId, membershipIds);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function removeHouseholdsAction(
  eventId: string,
  _prevState: DeleteResult,
  formData: FormData
): Promise<DeleteResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const subscriptionEventIds = formData.getAll("subscriptionEventIds").map(String);
  if (subscriptionEventIds.length === 0) {
    return { deleted: 0, errors: [{ id: "", reason: "Select at least one household." }] };
  }

  const result = await removeHouseholdsFromEvent(session, eventId, subscriptionEventIds);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function copyHouseholdsToOtherEventAction(
  eventId: string,
  _prevState: CopyToEventResult,
  formData: FormData
): Promise<CopyToEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const targetEventId = String(formData.get("targetEventId") ?? "");
  const householdIds = formData.getAll("householdIds").map(String);
  if (!targetEventId) return { copied: 0, error: "Choose an event to copy into." };
  if (householdIds.length === 0) return { copied: 0, error: "Select at least one household." };
  if (targetEventId === eventId) return { copied: 0, error: "Pick a different event than this one." };

  const org = await defaultOrganization();
  if (!org) return { copied: 0, error: "No organization set up yet." };

  const targetEvent = await eventForSession(session, org.id, targetEventId);
  if (!targetEvent) return { copied: 0, error: "Target event not found." };
  if (!targetEvent.seasonId) {
    return { copied: 0, error: "That event has no season, so it doesn't use the household/subscription model yet." };
  }

  const season = await seasonById(targetEvent.seasonId);
  const amountCents = season && season.pricingMode === "per_holiday" ? season.priceCents : 0;

  const result = await copyHouseholdsToEvent(session, {
    orgId: org.id,
    eventId: targetEventId,
    seasonId: targetEvent.seasonId,
    amountCents,
    householdIds,
  });

  revalidatePath(`/admin/events/${targetEventId}`);
  return result;
}


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
