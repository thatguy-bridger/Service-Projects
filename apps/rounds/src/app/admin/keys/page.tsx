import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, inviteKeysForOrg, eventsForSession } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { KeysClient } from "./KeysClient";

export const dynamic = "force-dynamic";

// Auth gate/topbar/tabs come from ../layout.tsx (OWNER/ADMIN only).
export default async function KeysPage() {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) notFound();

  const [keys, events] = await Promise.all([inviteKeysForOrg(session, org.id), eventsForSession(session, org.id)]);

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>Keys</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
        Issue invite keys that grant a role, org-wide or for a single event. Share the link or QR code — it works
        once someone signs in and redeems it. Revoke a key any time to stop new redemptions.
      </p>
      <KeysClient initialRows={keys} events={events.map((e) => ({ id: e.id, name: e.name }))} />
    </Card>
  );
}
