"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  getOrCreateDefaultOrganization,
  createEvent,
  createCategory,
  setEventCategory,
  type EventKind,
} from "@service-projects/database";
import { MODULE_DEFAULTS, OUTCOME_SETS, EVENT_KINDS } from "@/lib/eventKinds";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

export interface BulkEventInput {
  name: string;
  kind: string;
  serviceStartsAt: string; // date input value
  priceDollars: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "event";
}

/**
 * The one streamlined event creator: any number of events in a single
 * submit, all optionally landing in one category (existing or brand
 * new) so they're grouped and can share a bundle price right away —
 * replaces the old two-form split (a flag-season generator that only
 * knew about the 7 fixed holidays, and a single-event form for
 * everything else) with one generic path.
 */
export async function createEventsAction(input: {
  orgName: string;
  categoryId: string | null;
  newCategoryName: string;
  events: BulkEventInput[];
}): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const orgName = input.orgName.trim();
  if (!orgName) return { error: "Organization name is required." };

  const validEvents = input.events.filter((e) => e.name.trim() && e.serviceStartsAt);
  if (validEvents.length === 0) return { error: "Add at least one event with a name and date." };

  for (const e of validEvents) {
    if (!EVENT_KINDS.includes(e.kind as EventKind)) return { error: `Unknown event kind: ${e.kind}` };
    if (Number.isNaN(new Date(e.serviceStartsAt).getTime())) return { error: `Invalid date for "${e.name}".` };
  }

  const org = await getOrCreateDefaultOrganization(orgName);

  let categoryId = input.categoryId;
  const newCategoryName = input.newCategoryName.trim();
  if (!categoryId && newCategoryName) {
    const categoryResult = await createCategory(session, org.id, newCategoryName);
    if (!categoryResult.ok || !categoryResult.categoryId) {
      return { error: categoryResult.error ?? "Could not create the category." };
    }
    categoryId = categoryResult.categoryId;
  }

  for (let i = 0; i < validEvents.length; i++) {
    const e = validEvents[i];
    const kind = e.kind as EventKind;
    const serviceStartsAt = new Date(e.serviceStartsAt);
    const priceCents = Math.round((Number(e.priceDollars) || 0) * 100);
    const slug = `${slugify(e.name)}-${serviceStartsAt.getUTCFullYear()}-${Date.now().toString(36)}-${i}`;

    const event = await createEvent({
      orgId: org.id,
      kind,
      name: e.name.trim(),
      slug,
      status: "OPEN",
      priceCents,
      serviceStartsAt,
      serviceEndsAt: serviceStartsAt,
      modules: MODULE_DEFAULTS[kind] as unknown as Record<string, unknown>,
      outcomeSet: { outcomes: OUTCOME_SETS[kind] } as unknown as Record<string, unknown>,
      createdBy: session!.user.id,
    });

    if (categoryId) {
      await setEventCategory(session, org.id, event.id, categoryId);
    }
  }

  revalidatePath("/admin/events");
  revalidatePath("/admin/categories");
  revalidatePath("/signup");
  return { ok: true };
}
