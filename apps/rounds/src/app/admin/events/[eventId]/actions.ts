"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventForSession,
  importHouseholdsForEvent,
  addEventMembership,
  removeEventMemberships,
  removeHouseholdsFromEvent,
  copyHouseholdsToEvent,
  updateEvent,
  updateEventMembershipRole,
  generateStopsFromSubscriptions,
  createPairedEvent,
  updateEventStopCardLayout,
  updateEventRouteScreenLayout,
  updateEventLandingLayout,
  type ImportResult,
  type DeleteResult,
  type CopyToEventResult,
  type UpdateEventResult,
  type GenerateStopsResult,
  type CreatePairedEventResult,
  type EventStatus,
  type Role,
  type EventKind,
  type ScreenLayout,
} from "@service-projects/database";
import { MODULE_DEFAULTS, OUTCOME_SETS } from "@/lib/eventKinds";

const PAIR_KIND: Partial<Record<EventKind, EventKind>> = {
  FLAG_SETOUT: "FLAG_PICKUP",
  FLAG_PICKUP: "FLAG_SETOUT",
};
const PAIR_LABEL: Partial<Record<EventKind, string>> = {
  FLAG_PICKUP: "Pickup",
  FLAG_SETOUT: "Set-Out",
};

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

export async function updateEventAction(
  eventId: string,
  _prevState: UpdateEventResult,
  formData: FormData
): Promise<UpdateEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "") as EventStatus;
  const serviceStartsAt = new Date(String(formData.get("serviceStartsAt") ?? ""));
  const serviceEndsAt = new Date(String(formData.get("serviceEndsAt") ?? ""));
  if (!name) return { ok: false, error: "Name is required." };
  if (Number.isNaN(serviceStartsAt.getTime()) || Number.isNaN(serviceEndsAt.getTime())) {
    return { ok: false, error: "Enter valid start/end dates." };
  }

  const result = await updateEvent(session, org.id, eventId, { name, status, serviceStartsAt, serviceEndsAt });
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  return result;
}

export interface UpdatePersonRoleResult {
  ok: boolean;
  error?: string;
}

export async function updateEventPersonRoleAction(
  eventId: string,
  membershipId: string,
  _prevState: UpdatePersonRoleResult,
  formData: FormData
): Promise<UpdatePersonRoleResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const role = String(formData.get("role") ?? "") as Role;
  if (!EVENT_ROLES.includes(role)) return { ok: false, error: "Pick a role." };

  const result = await updateEventMembershipRole(session, eventId, membershipId, role);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
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

  const result = await copyHouseholdsToEvent(session, {
    orgId: org.id,
    eventId: targetEventId,
    categoryId: targetEvent.categoryId,
    amountCents: targetEvent.priceCents,
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

  const csvText = await file.text();
  const result = await importHouseholdsForEvent(session, {
    orgId: org.id,
    categoryId: event.categoryId,
    eventId: event.id,
    csvText,
  });

  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function createPairedEventAction(eventId: string): Promise<CreatePairedEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const source = await eventForSession(session, org.id, eventId);
  if (!source) return { ok: false, error: "Event not found." };

  const pairedKind = PAIR_KIND[source.kind];
  if (!pairedKind) return { ok: false, error: `${source.kind} events can't be paired.` };

  const label = PAIR_LABEL[pairedKind] ?? pairedKind;
  const sourceLabel = PAIR_LABEL[source.kind];
  const name = sourceLabel ? source.name.replace(sourceLabel, label) : `${source.name} (${label})`;
  const slug = `${source.slug}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;

  // Pickup defaults to the day after set-out (a common real-world gap);
  // an admin can move it from the "Event Dates" tab afterward.
  const serviceStartsAt = new Date(source.serviceStartsAt);
  serviceStartsAt.setUTCDate(serviceStartsAt.getUTCDate() + 1);
  const serviceEndsAt = new Date(serviceStartsAt);
  serviceEndsAt.setUTCHours(serviceEndsAt.getUTCHours() + 4);

  const result = await createPairedEvent(session, org.id, eventId, {
    name,
    slug,
    serviceStartsAt,
    serviceEndsAt,
    modules: MODULE_DEFAULTS[pairedKind] as unknown as Record<string, unknown>,
    outcomeSet: { outcomes: OUTCOME_SETS[pairedKind] } as unknown as Record<string, unknown>,
    createdBy: session!.user.id,
  });

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
  return result;
}

export async function updateEventStopCardLayoutAction(eventId: string, layout: ScreenLayout): Promise<UpdateEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await updateEventStopCardLayout(session, org.id, eventId, layout);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function updateEventRouteScreenLayoutAction(eventId: string, layout: ScreenLayout): Promise<UpdateEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await updateEventRouteScreenLayout(session, org.id, eventId, layout);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function updateEventLandingLayoutAction(eventId: string, layout: ScreenLayout): Promise<UpdateEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  // /events/[slug] is force-dynamic (always reads fresh), so no revalidatePath needed there.
  const result = await updateEventLandingLayout(session, org.id, eventId, layout);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function generateStopsAction(
  eventId: string,
  _prevState: GenerateStopsResult,
  _formData: FormData
): Promise<GenerateStopsResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN", "COORDINATOR"], { eventId });

  const result = await generateStopsFromSubscriptions(session, eventId);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

// DataTable-compatible variants (plain args, not FormData).

export async function savePersonRoleAction(
  eventId: string,
  membershipId: string,
  patch: Record<string, string>
): Promise<UpdatePersonRoleResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const role = (patch.role ?? "") as Role;
  if (!EVENT_ROLES.includes(role)) return { ok: false, error: "Pick a role." };

  const result = await updateEventMembershipRole(session, eventId, membershipId, role);
  revalidatePath(`/admin/events/${eventId}`);
  return result;
}

export async function removePeopleAction(eventId: string, membershipIds: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const result = await removeEventMemberships(session, eventId, membershipIds);
  revalidatePath(`/admin/events/${eventId}`);
  return { deleted: result.removed };
}

export async function addPersonAction(
  eventId: string,
  values: Record<string, string>
): Promise<MembershipActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { error: "No organization set up yet." };

  const email = (values.email ?? "").trim();
  const role = (values.role ?? "") as Role;
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
