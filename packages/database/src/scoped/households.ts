import { Prisma, type SubStatus } from "@prisma/client";
import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

// SPEC.md §6: household data (home addresses, access notes) never goes
// through a raw `prisma.household` call in app code — see the ESLint rule
// in packages/config/eslint-preset.js.
export async function householdsForSession(session: SessionLike | null | undefined, orgId: string) {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];
  return prisma.household.findMany({ where: { orgId, deletedAt: null } });
}

export async function householdForSession(
  session: SessionLike | null | undefined,
  orgId: string,
  householdId: string
) {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return null;
  return prisma.household.findFirst({ where: { id: householdId, orgId, deletedAt: null } });
}

// The org-wide "data library" — search across every household ever
// created for this org (not scoped to one event), so an admin can find
// and reuse a household without re-typing it or round-tripping a CSV.
// Capped at 50 results: this is a search box, not a full listing — an
// empty/unbounded query would dump the entire org.
export async function searchHouseholds(session: SessionLike | null | undefined, orgId: string, query: string) {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];
  const q = query.trim();
  if (!q) return [];

  return prisma.household.findMany({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        { contactName: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
        { contactPhone: { contains: q, mode: "insensitive" } },
        { addressInput: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { contactName: "asc" },
    take: 50,
  });
}

export interface CopyToEventResult {
  copied: number;
  error?: string;
}

// The other half of the library: copy already-known households straight
// into an event — no CSV in the middle. Same underlying write as
// importHouseholdsForEvent (upsert Subscription + SubscriptionEvent),
// just addressed by existing Household id instead of parsed CSV rows.
export async function copyHouseholdsToEvent(
  session: SessionLike | null | undefined,
  input: { orgId: string; eventId: string; seasonId: string; amountCents: number; householdIds: string[] }
): Promise<CopyToEventResult> {
  const membership = await resolveMembership(session, input.eventId);
  if (!membership || !isStaff(membership.role)) return { copied: 0, error: "Forbidden" };
  if (input.householdIds.length === 0) return { copied: 0, error: "No households selected." };

  let copied = 0;
  for (const householdId of input.householdIds) {
    const household = await prisma.household.findFirst({ where: { id: householdId, orgId: input.orgId } });
    if (!household) continue; // skip anything that doesn't belong to this org

    const subscription = await prisma.subscription.upsert({
      where: { householdId_seasonId: { householdId, seasonId: input.seasonId } },
      update: {},
      create: { householdId, seasonId: input.seasonId, status: "PENDING_PAYMENT", amountCents: input.amountCents },
    });

    await prisma.subscriptionEvent.upsert({
      where: { subscriptionId_eventId: { subscriptionId: subscription.id, eventId: input.eventId } },
      update: {},
      create: { subscriptionId: subscription.id, eventId: input.eventId },
    });

    copied++;
  }

  return { copied };
}

export interface HouseholdForEvent {
  subscriptionEventId: string;
  skipped: boolean;
  subscriptionId: string;
  subscriptionStatus: string;
  amountCents: number;
  household: {
    id: string;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    addressInput: string;
    placementNote: string | null;
    accessNotes: string | null;
  };
}

// Everyone signed up for one event — the data an admin actually wants
// when they click into an event (SPEC.md's event-as-its-own-dataset
// shape). Staff-only, same as householdsForSession above.
export async function householdsForEvent(
  session: SessionLike | null | undefined,
  orgId: string,
  eventId: string
): Promise<HouseholdForEvent[]> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return [];

  const subEvents = await prisma.subscriptionEvent.findMany({
    where: { eventId, subscription: { household: { orgId } } },
    include: { subscription: { include: { household: true } } },
    orderBy: { subscription: { createdAt: "desc" } },
  });

  return subEvents.map((se) => ({
    subscriptionEventId: se.id,
    skipped: se.skipped,
    subscriptionId: se.subscription.id,
    subscriptionStatus: se.subscription.status,
    amountCents: se.subscription.amountCents,
    household: {
      id: se.subscription.household.id,
      contactName: se.subscription.household.contactName,
      contactEmail: se.subscription.household.contactEmail,
      contactPhone: se.subscription.household.contactPhone,
      addressInput: se.subscription.household.addressInput,
      placementNote: se.subscription.household.placementNote,
      accessNotes: se.subscription.household.accessNotes,
    },
  }));
}

// Minimal RFC-4180-ish CSV parser (quoted fields, escaped "" quotes,
// \r\n or \n line endings) — hand-written rather than a dependency,
// consistent with the rest of this app's low-dependency approach. Not a
// general-purpose CSV library: good enough for the fixed column set
// this app's own export produces.
function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

function parseCsvRows(text: string): Record<string, string>[] {
  const table = parseCsvTable(text);
  if (table.length === 0) return [];
  const header = table[0];
  return table.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((name, idx) => {
      obj[name] = cells[idx] ?? "";
    });
    return obj;
  });
}

const VALID_SUB_STATUSES: SubStatus[] = ["DRAFT", "PENDING_PAYMENT", "ACTIVE", "LAPSED", "CANCELLED"];

export interface ImportError {
  row: number; // 1-indexed, counting the header row, so it matches what a spreadsheet shows
  reason: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportError[];
}

/**
 * Bulk-adds households to one event from a CSV — same column contract as
 * the export route (Name, Email, Phone, Address, Placement note, Access
 * notes, Amount, Status, Skipped), so export → edit → import round-trips,
 * and exporting one event and importing into another is how "copy data
 * from another event" works without a separate clone feature.
 *
 * Dedup rule: if Email is given and matches an existing Household in
 * this org (case-insensitive), that household is updated in place;
 * otherwise a new Household is created. No address-based fuzzy matching
 * — too easy to silently merge two different households that happen to
 * type their address similarly.
 *
 * A row with a validation problem is skipped and recorded in
 * ImportResult.errors, not aborted — one bad row (or a spreadsheet's
 * blank trailing rows) shouldn't block the rest of a real import.
 */
export async function importHouseholdsForEvent(
  session: SessionLike | null | undefined,
  input: {
    orgId: string;
    seasonId: string;
    eventId: string;
    csvText: string;
  }
): Promise<ImportResult> {
  // Unlike submitSignup, this is a write nobody outside staff should
  // ever reach — checked here too, not just in the calling server
  // action, so this function is safe to call from anywhere later.
  const membership = await resolveMembership(session, input.eventId);
  if (!membership || !isStaff(membership.role)) {
    return { imported: 0, errors: [{ row: 0, reason: "Forbidden" }] };
  }

  const rows = parseCsvRows(input.csvText);
  const errors: ImportError[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 2; // +1 for header, +1 for 1-indexing
    const name = (r["Name"] ?? "").trim();
    const address = (r["Address"] ?? "").trim();
    if (!name || !address) {
      errors.push({ row: rowNumber, reason: "Missing Name or Address" });
      continue;
    }

    const email = (r["Email"] ?? "").trim() || undefined;
    const phone = (r["Phone"] ?? "").trim() || undefined;
    const placementNote = (r["Placement note"] ?? "").trim() || undefined;
    const accessNotes = (r["Access notes"] ?? "").trim() || undefined;

    const amountDollars = Number(r["Amount"] ?? "0");
    const amountCents = Number.isFinite(amountDollars) ? Math.round(amountDollars * 100) : 0;

    const statusRaw = (r["Status"] ?? "").trim().toUpperCase() as SubStatus;
    const status: SubStatus = VALID_SUB_STATUSES.includes(statusRaw) ? statusRaw : "PENDING_PAYMENT";
    const skipped = (r["Skipped"] ?? "").trim().toLowerCase() === "yes";

    const existing = email
      ? await prisma.household.findFirst({
          where: { orgId: input.orgId, contactEmail: { equals: email, mode: "insensitive" } },
        })
      : null;

    const household = existing
      ? await prisma.household.update({
          where: { id: existing.id },
          data: {
            contactName: name,
            contactPhone: phone ?? existing.contactPhone,
            addressInput: address,
            placementNote: placementNote ?? existing.placementNote,
            accessNotes: accessNotes ?? existing.accessNotes,
          },
        })
      : await prisma.household.create({
          data: {
            orgId: input.orgId,
            contactName: name,
            contactEmail: email,
            contactPhone: phone,
            addressInput: address,
            address: { raw: address, source: "csv-import" } as Prisma.InputJsonValue,
            placementNote,
            accessNotes,
          },
        });

    const subscription = await prisma.subscription.upsert({
      where: { householdId_seasonId: { householdId: household.id, seasonId: input.seasonId } },
      update: { status, amountCents },
      create: { householdId: household.id, seasonId: input.seasonId, status, amountCents },
    });

    await prisma.subscriptionEvent.upsert({
      where: { subscriptionId_eventId: { subscriptionId: subscription.id, eventId: input.eventId } },
      update: { skipped },
      create: { subscriptionId: subscription.id, eventId: input.eventId, skipped },
    });

    imported++;
  }

  return { imported, errors };
}

export interface SignupSubmission {
  orgId: string;
  seasonId: string;
  eventIds: string[];
  amountCents: number;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  addressInput: string;
  address: Record<string, unknown>;
  lat?: number;
  lng?: number;
  geocodeConfidence?: number;
  geocodeSource?: string;
  placementNote?: string;
  accessNotes?: string;
}

/**
 * Public, unauthenticated write — the whole point of the signup flow is
 * that no account is required (SPEC.md §3.2), so this deliberately isn't
 * session-gated like the helpers above (same reasoning as
 * currentSeasonForOrg in scoped/seasons.ts).
 *
 * No Stripe integration exists yet (docs/rounds/PHASE-1.md), so the
 * created Subscription is left in PENDING_PAYMENT rather than ACTIVE —
 * an honest reflection of what actually happened, not a shortcut around
 * the missing payment step.
 */
export async function submitSignup(input: SignupSubmission) {
  const household = await prisma.household.create({
    data: {
      orgId: input.orgId,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      addressInput: input.addressInput,
      address: input.address as Prisma.InputJsonValue,
      lat: input.lat,
      lng: input.lng,
      geocodeConfidence: input.geocodeConfidence,
      geocodeSource: input.geocodeSource,
      placementNote: input.placementNote,
      accessNotes: input.accessNotes,
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      householdId: household.id,
      seasonId: input.seasonId,
      status: "PENDING_PAYMENT",
      amountCents: input.amountCents,
      events: {
        create: input.eventIds.map((eventId) => ({ eventId })),
      },
    },
  });

  return { householdId: household.id, subscriptionId: subscription.id };
}
