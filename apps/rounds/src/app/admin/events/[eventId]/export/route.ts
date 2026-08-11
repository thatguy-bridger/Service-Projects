import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireRole, rateLimit, clientIpFromHeaders, hashIp } from "@service-projects/core-auth";
import { defaultOrganization, eventForSession, householdsForEvent, recordAuditEvent } from "@service-projects/database";

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(request: Request, { params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  // Redundant with admin/layout.tsx's gate for page navigation, but this
  // is its own route (not wrapped by that layout's React tree), so it
  // needs its own real check.
  await requireRole(session, ["OWNER", "ADMIN"]);

  // SPEC.md §20: "Exports audited, rate-limited, and warned before
  // download." The warning lives in the UI (a confirm before this link
  // is even followed -- see the event detail page); this route owns the
  // other two.
  const ip = clientIpFromHeaders(request.headers);
  const { allowed, retryAfterSeconds } = rateLimit(`export:${session!.user!.id}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return new NextResponse(`Too many exports — try again in ${retryAfterSeconds ?? 60}s.`, { status: 429 });
  }

  const org = await defaultOrganization();
  if (!org) return new NextResponse("No organization", { status: 404 });

  const event = await eventForSession(session, org.id, params.eventId);
  if (!event) return new NextResponse("Not found", { status: 404 });

  const rows = await householdsForEvent(session, org.id, params.eventId);

  await recordAuditEvent(session, {
    orgId: org.id,
    action: "households.exported",
    entity: "Event",
    entityId: event.id,
    after: { count: rows.length },
    ipHash: hashIp(ip),
  });

  // Column names/order are the import contract too (see ../import) — an
  // exported CSV can be edited and re-imported, or imported into a
  // different event, unchanged.
  const header = ["Name", "Email", "Phone", "Address", "Placement note", "Access notes", "Amount", "Status", "Skipped"];
  const body = rows.map((r) =>
    [
      r.household.contactName,
      r.household.contactEmail ?? "",
      r.household.contactPhone ?? "",
      r.household.addressInput,
      r.household.placementNote ?? "",
      r.household.accessNotes ?? "",
      (r.amountCents / 100).toFixed(2),
      r.subscriptionStatus,
      r.skipped ? "yes" : "no",
    ]
      .map(csvCell)
      .join(",")
  );

  const csv = [header.join(","), ...body].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-households.csv"`,
    },
  });
}
