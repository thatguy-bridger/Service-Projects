import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, territoriesForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { TerritoriesClient } from "./TerritoriesClient";

export const dynamic = "force-dynamic";

// Auth gate/topbar/tabs come from ../layout.tsx (OWNER/ADMIN only).
// Phase 6 (SPEC.md §9.2) territory drawing/saving -- the fill step
// (address-point import) needs a UGRC developer key this environment
// doesn't have, so addressPointCount/lastFilledAt stay null for now;
// see docs/rounds/OPEN-QUESTIONS.md.
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
        Draw and save reusable polygons — territory fill (importing addresses within a shape) needs a UGRC
        developer key that isn&apos;t configured yet, so saved territories are shapes only for now.
      </p>
      <TerritoriesClient initialRows={territories} apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API} />
    </Card>
  );
}
