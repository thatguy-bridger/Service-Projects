"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  getOrCreateDefaultOrganization,
  createEvent,
  createCategory,
  setEventCategory,
  categoriesForOrg,
  type EventKind,
} from "@service-projects/database";
import { FLAG_HOLIDAYS } from "@/lib/holidays";
import { MODULE_DEFAULTS, OUTCOME_SETS } from "@/lib/eventKinds";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

// One click, matches exactly what packages/database/prisma/seed.mjs does
// by hand: an org (created if this is the very first run), a Category
// for the year (so the 7 events are grouped and can share a bundle
// price later from /admin/categories), and the 7 standard holiday
// Events, real calendar dates via FLAG_HOLIDAYS. Each Event gets its own
// priceCents — no separate Season model.
export async function generateFlagEvents(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const orgName = String(formData.get("orgName") ?? "").trim();
  const year = Number(formData.get("year"));
  const priceDollars = Number(formData.get("priceDollars"));

  if (!orgName || !Number.isInteger(year) || Number.isNaN(priceDollars) || priceDollars < 0) {
    return { error: "Enter a valid organization name, year, and price." };
  }

  const org = await getOrCreateDefaultOrganization(orgName);

  const categoryName = `${year} Flag Events`;
  const existingCategories = await categoriesForOrg(org.id);
  if (existingCategories.some((c) => c.name === categoryName)) {
    return { error: `${categoryName} already exists.` };
  }

  const priceCents = Math.round(priceDollars * 100);
  const categoryResult = await createCategory(session, org.id, categoryName);
  if (!categoryResult.ok || !categoryResult.categoryId) {
    return { error: categoryResult.error ?? "Could not create a category for this year." };
  }

  const kind: EventKind = "FLAG_SETOUT";
  for (const holiday of FLAG_HOLIDAYS) {
    const serviceStartsAt = holiday.dateFor(year);
    serviceStartsAt.setUTCHours(12); // nominal 6am Mountain start
    const serviceEndsAt = new Date(serviceStartsAt);
    serviceEndsAt.setUTCHours(serviceStartsAt.getUTCHours() + 4);

    const event = await createEvent({
      orgId: org.id,
      kind,
      name: `${holiday.name} ${year} — Flag Set-Out`,
      slug: `${holiday.key}-${year}`,
      status: "OPEN",
      priceCents,
      serviceStartsAt,
      serviceEndsAt,
      modules: MODULE_DEFAULTS[kind] as unknown as Record<string, unknown>,
      outcomeSet: { outcomes: OUTCOME_SETS[kind] } as unknown as Record<string, unknown>,
      createdBy: session!.user.id,
    });
    await setEventCategory(session, org.id, event.id, categoryResult.categoryId);
  }

  revalidatePath("/admin/events");
  revalidatePath("/admin/categories");
  revalidatePath("/signup");
  return { ok: true };
}

// A single custom event of any kind, for anything outside the standard
// flag-holiday year (e.g. a one-off fundraiser). Module matrix and
// outcome set are always the kind's default — SPEC.md §2.1 lets an admin
// override either later; there's no override UI yet, so this creates
// with the sensible default rather than blocking on that.
export async function createCustomEvent(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const orgName = String(formData.get("orgName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as EventKind;
  const startInput = String(formData.get("serviceStartsAt") ?? "");
  const endInput = String(formData.get("serviceEndsAt") ?? "");

  if (!orgName || !name || !kind || !startInput || !endInput) {
    return { error: "All fields are required." };
  }
  if (!(kind in MODULE_DEFAULTS)) {
    return { error: "Unknown event kind." };
  }

  const serviceStartsAt = new Date(startInput);
  const serviceEndsAt = new Date(endInput);
  if (Number.isNaN(serviceStartsAt.getTime()) || Number.isNaN(serviceEndsAt.getTime())) {
    return { error: "Invalid dates." };
  }

  const org = await getOrCreateDefaultOrganization(orgName);
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${serviceStartsAt.getUTCFullYear()}`;

  await createEvent({
    orgId: org.id,
    kind,
    name,
    slug,
    status: "OPEN",
    serviceStartsAt,
    serviceEndsAt,
    modules: MODULE_DEFAULTS[kind] as unknown as Record<string, unknown>,
    outcomeSet: { outcomes: OUTCOME_SETS[kind] } as unknown as Record<string, unknown>,
    createdBy: session!.user.id,
  });

  revalidatePath("/admin/events");
  return { ok: true };
}
