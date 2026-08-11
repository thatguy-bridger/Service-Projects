"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  defaultOrganization,
  deleteEvents,
  createEvent,
  updateEvent,
  setEventCategory,
  type EventKind,
  type EventStatus,
  type UpdateEventResult,
} from "@service-projects/database";
import { MODULE_DEFAULTS, OUTCOME_SETS, EVENT_KINDS } from "@/lib/eventKinds";

export async function deleteOpportunitiesAction(eventIds: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { deleted: 0 };
  const result = await deleteEvents(session, org.id, eventIds);
  revalidatePath("/admin/events");
  return result;
}

export async function saveOpportunityRowAction(eventId: string, patch: Record<string, string>): Promise<UpdateEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const serviceStartsAt = patch.serviceStartsAt ? new Date(patch.serviceStartsAt) : undefined;
  const result = await updateEvent(session, org.id, eventId, {
    name: patch.name,
    status: patch.status as EventStatus | undefined,
    priceCents: patch.priceCents ? Math.round(Number(patch.priceCents) * 100) : undefined,
    serviceStartsAt,
  });
  revalidatePath("/admin/events");
  return result;
}

export async function setOpportunityCategoryAction(
  eventId: string,
  categoryId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };
  const result = await setEventCategory(session, org.id, eventId, categoryId);
  revalidatePath("/admin/events");
  return result;
}

export async function moveOpportunitiesToCategoryAction(
  eventIds: string[],
  categoryId: string | null
): Promise<{ moved: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { moved: 0 };
  let moved = 0;
  for (const eventId of eventIds) {
    const result = await setEventCategory(session, org.id, eventId, categoryId);
    if (result.ok) moved += 1;
  }
  revalidatePath("/admin/events");
  return { moved };
}

export async function addOpportunityAction(
  fixedKind: EventKind | null,
  fixedCategoryId: string | null,
  values: Record<string, string>
): Promise<UpdateEventResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const name = (values.name ?? "").trim();
  const kind = (fixedKind ?? values.kind) as EventKind;
  const startInput = values.serviceStartsAt ?? "";
  if (!name || !kind || !EVENT_KINDS.includes(kind) || !startInput) {
    return { ok: false, error: "Name, kind, and a start date are required." };
  }
  const serviceStartsAt = new Date(startInput);
  if (Number.isNaN(serviceStartsAt.getTime())) return { ok: false, error: "Invalid date." };

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${serviceStartsAt.getUTCFullYear()}-${Date.now().toString(36)}`;

  const priceCents = values.priceCents ? Math.round(Number(values.priceCents) * 100) : 0;

  const event = await createEvent({
    orgId: org.id,
    kind,
    name,
    slug,
    // Left as the schema default (DRAFT) -- see createEventsAction's
    // matching comment in ./actions.ts. Publishing is a Category-level
    // action now; a quick-added event shouldn't already be OPEN before
    // its category has gone live.
    priceCents,
    serviceStartsAt,
    serviceEndsAt: serviceStartsAt,
    modules: MODULE_DEFAULTS[kind] as unknown as Record<string, unknown>,
    outcomeSet: { outcomes: OUTCOME_SETS[kind] } as unknown as Record<string, unknown>,
    createdBy: session!.user.id,
  });

  if (fixedCategoryId) {
    await setEventCategory(session, org.id, event.id, fixedCategoryId);
  }

  revalidatePath("/admin/events");
  return { ok: true };
}
