import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { defaultOrganization, eventForSession, householdsForEvent } from "@service-projects/database";

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(_request: Request, { params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  // Redundant with admin/layout.tsx's gate for page navigation, but this
  // is its own route (not wrapped by that layout's React tree), so it
  // needs its own real check.
  await requireRole(session, ["OWNER", "ADMIN"]);

  const org = await defaultOrganization();
  if (!org) return new NextResponse("No organization", { status: 404 });

  const event = await eventForSession(session, org.id, params.eventId);
  if (!event) return new NextResponse("Not found", { status: 404 });

  const rows = await householdsForEvent(session, org.id, params.eventId);

  const header = ["Name", "Email", "Phone", "Address", "Placement note", "Access notes", "Status", "Skipped"];
  const body = rows.map((r) =>
    [
      r.household.contactName,
      r.household.contactEmail ?? "",
      r.household.contactPhone ?? "",
      r.household.addressInput,
      r.household.placementNote ?? "",
      r.household.accessNotes ?? "",
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
