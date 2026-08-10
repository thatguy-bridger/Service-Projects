import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { myRoutesForSession } from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";
import { AppTopbar } from "../AppTopbar";

// Phase 4 (SPEC.md §16): the volunteer's own entry point -- every route
// assigned to them, across every event, oldest first. Deliberately not
// under /admin: this is real query-level redaction (myRoutesForSession
// filters by RouteAssignment.userId directly, not by role), so a
// volunteer with no staff role at all still gets a working page here.
export const dynamic = "force-dynamic";

export default async function MyRoutesPage() {
  const session = await getServerSession(authOptions);
  const routes = await myRoutesForSession(session);

  return (
    <>
      <AppTopbar section="My routes" />
      <main className="rounds-shell">
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>My routes</h1>
        {!session?.user ? (
          <Card>
            <p style={{ color: "var(--text-secondary)" }}>
              Sign in to see routes an organizer has assigned to you.
            </p>
          </Card>
        ) : routes.length === 0 ? (
          <Card>
            <p style={{ color: "var(--text-secondary)" }}>
              No routes assigned yet — an organizer assigns you from an event&apos;s Routes tab.
            </p>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {routes.map((r) => (
              <a key={r.id} href={`/my-routes/${r.id}`} style={{ textDecoration: "none" }}>
                <Card className="card--interactive">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>{r.name}</p>
                      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{r.eventName}</p>
                    </div>
                    <Badge tone={r.visitedCount >= r.stopCount && r.stopCount > 0 ? "success" : "accent"}>
                      {r.visitedCount}/{r.stopCount} done
                    </Badge>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
