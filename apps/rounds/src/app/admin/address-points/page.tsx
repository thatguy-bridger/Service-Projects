import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { addressPointSources } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { AddressPointsClient } from "./AddressPointsClient";

// SPEC.md §9.2: the local, refreshable address-point import that backs
// territory fill (see Territory.addressPointCount / previewTerritoryFill
// in packages/database/src/scoped/territories.ts). Not tied to UGRC at
// all -- any CSV with lat/lng and an address works, so a county's own
// open-data export or an OpenAddresses.io download both import the same
// way. "Refresh" just means re-importing the same source label; it
// replaces that batch rather than appending duplicates.
export const dynamic = "force-dynamic";

export default async function AddressPointsPage() {
  const session = await getServerSession(authOptions);
  const sources = await addressPointSources(session);

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        Address points
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
        The local dataset territory fill counts against. Import as many CSV files as you need — each gets its own
        source label so you can track and refresh them independently.
      </p>
      <AddressPointsClient initialSources={sources} />
    </Card>
  );
}
