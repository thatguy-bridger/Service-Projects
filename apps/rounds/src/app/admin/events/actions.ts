"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  getOrCreateDefaultOrganization,
  defaultOrganization,
  createEvent,
  createCategory,
  setEventCategory,
  categoriesForOrg,
  eventsForSession,
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

function shiftYearInName(name: string, yearOffset: number): string {
  return name.replace(/\b(19|20)\d{2}\b/, (match) => String(Number(match) + yearOffset));
}

export interface ImportFromLastYearResult extends ActionResult {
  created?: number;
}

/**
 * SPEC.md Phase 6's "Import from last year": clone every event in an
 * existing category into a brand-new category, each shifted forward by
 * `yearOffset` years (dates, and the year inside the name/category name
 * if one appears there) -- same kind, price, and module defaults, all
 * DRAFT so an admin reviews before publishing. Doesn't touch the source
 * category or its events at all; this only ever adds new rows.
 */
export async function importCategoryFromPreviousYearAction(
  sourceCategoryId: string,
  yearOffset: number
): Promise<ImportFromLastYearResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return { error: "No organization set up yet." };
  if (!Number.isInteger(yearOffset) || yearOffset === 0) return { error: "Enter a valid year offset." };

  const categories = await categoriesForOrg(org.id);
  const sourceCategory = categories.find((c) => c.id === sourceCategoryId);
  if (!sourceCategory) return { error: "Category not found." };

  const allEvents = await eventsForSession(session, org.id);
  const sourceEvents = allEvents.filter((e) => e.categoryId === sourceCategoryId);
  if (sourceEvents.length === 0) return { error: "That category has no events to import." };

  const newCategoryName = shiftYearInName(sourceCategory.name, yearOffset);
  const categoryResult = await createCategory(session, org.id, newCategoryName, sourceCategory.priceCents);
  if (!categoryResult.ok || !categoryResult.categoryId) {
    return { error: categoryResult.error ?? "Could not create the new category." };
  }

  let created = 0;
  for (const e of sourceEvents) {
    const serviceStartsAt = new Date(e.serviceStartsAt);
    serviceStartsAt.setUTCFullYear(serviceStartsAt.getUTCFullYear() + yearOffset);
    const serviceEndsAt = new Date(e.serviceEndsAt);
    serviceEndsAt.setUTCFullYear(serviceEndsAt.getUTCFullYear() + yearOffset);

    const name = shiftYearInName(e.name, yearOffset);
    const slug = `${slugify(name)}-${serviceStartsAt.getUTCFullYear()}-${Date.now().toString(36)}-${created}`;

    const event = await createEvent({
      orgId: org.id,
      kind: e.kind,
      name,
      slug,
      status: "DRAFT",
      priceCents: e.priceCents,
      serviceStartsAt,
      serviceEndsAt,
      modules: e.modules as Record<string, unknown>,
      outcomeSet: e.outcomeSet as Record<string, unknown>,
      createdBy: session!.user.id,
    });
    await setEventCategory(session, org.id, event.id, categoryResult.categoryId);
    created++;
  }

  revalidatePath("/admin/events");
  revalidatePath("/admin/categories");
  return { ok: true, created };
}
