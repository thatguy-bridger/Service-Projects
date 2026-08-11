import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, territoriesForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { TerritoriesClient } from "./TerritoriesClient";

export const dynamic = "force-dynamic";

// Auth gate/topbar/tabs come from ../layout.tsx (OWNER/ADMIN only).
// Phase 6 (SPEC.md §9.2) territory drawing/saving + fill. Fill counts
// against a local AddressPoint import (see /admin/address-points and
// previewTerritoryFill) rather than a live UGRC call -- UGRC's
// developer-key self-service portal locks keys to a single IP, which
// doesn't work from Vercel's rotating outbound IPs; a local, refreshable
// import sidesteps that entirely and matches what SPEC.md §9.2 always
// intended anyway ("import once, refresh quarterly" beats a live call
// per polygon).
export default async function TerritoriesPage() {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) notFound();

  const territories = await territoriesForOrg(session, org.id);

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        Territories
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
        Draw and save reusable polygons, then check how many imported address points fall inside each one — import
        the address data first at <a href="/admin/address-points">Admin → Address points</a>.
      </p>
      <TerritoriesClient initialRows={territories} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API} />
    </Card>
  );
}
