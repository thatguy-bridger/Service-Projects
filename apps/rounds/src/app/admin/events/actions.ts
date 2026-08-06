"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  getOrCreateDefaultOrganization,
  createSeason,
  seasonForYear,
  createEvent,
  type EventKind,
} from "@service-projects/database";
import { FLAG_HOLIDAYS } from "@/lib/holidays";
import { MODULE_DEFAULTS, OUTCOME_SETS } from "@/lib/eventKinds";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

// One click, matches exactly what packages/database/prisma/seed.mjs does
// by hand: an org (created if this is the very first season), a Season,
// and the 7 standard holiday Events, real calendar dates via
// FLAG_HOLIDAYS. Naming (slug `${key}-${year}`, name
// `${label} ${year} — Flag Set-Out`) intentionally matches the seed
// script exactly — apps/rounds/.../signup/page.tsx strips those exact
// strings back off to display the holiday name.
export async function generateFlagSeason(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const orgName = String(formData.get("orgName") ?? "").trim();
  const year = Number(formData.get("year"));
  const priceDollars = Number(formData.get("priceDollars"));

  if (!orgName || !Number.isInteger(year) || Number.isNaN(priceDollars) || priceDollars < 0) {
    return { error: "Enter a valid organization name, year, and price." };
  }

  const org = await getOrCreateDefaultOrganization(orgName);

  const existingSeason = await seasonForYear(org.id, year);
  if (existingSeason) {
    return { error: `A season for ${year} already exists.` };
  }

  const priceCents = Math.round(priceDollars * 100);
  const season = await createSeason({
    orgId: org.id,
    year,
    name: `${year} Flag Season`,
    priceCents,
    pricingMode: "per_holiday",
  });

  const kind: EventKind = "FLAG_SETOUT";
  for (const holiday of FLAG_HOLIDAYS) {
    const serviceStartsAt = holiday.dateFor(year);
    serviceStartsAt.setUTCHours(12); // nominal 6am Mountain start
    const serviceEndsAt = new Date(serviceStartsAt);
    serviceEndsAt.setUTCHours(serviceStartsAt.getUTCHours() + 4);

    await createEvent({
      orgId: org.id,
      seasonId: season.id,
      kind,
      name: `${holiday.name} ${year} — Flag Set-Out`,
      slug: `${holiday.key}-${year}`,
      status: "OPEN",
      serviceStartsAt,
      serviceEndsAt,
      modules: MODULE_DEFAULTS[kind] as unknown as Record<string, unknown>,
      outcomeSet: { outcomes: OUTCOME_SETS[kind] } as unknown as Record<string, unknown>,
      createdBy: session!.user.id,
    });
  }

  revalidatePath("/admin/events");
  revalidatePath("/signup");
  return { ok: true };
}

// A single custom event of any kind, for anything outside the standard
// flag-holiday season (e.g. a one-off fundraiser). Module matrix and
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
