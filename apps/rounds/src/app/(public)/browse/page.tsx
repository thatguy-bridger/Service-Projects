import { defaultOrganization, openEventsForSignup } from "@service-projects/database";
import { Badge, Card } from "@service-projects/ui";
import { formatCentsShort, formatHolidayDate } from "@/lib/format";
import { AppTopbar } from "../../AppTopbar";

// SPEC.md §5.1/§14.2: the "Previewer event browser" -- public, no
// account needed, read-only. Reuses openEventsForSignup (the exact set
// signup itself shows) so this can never advertise something signup
// wouldn't actually let someone sign up for. Distinct from /signup:
// this is for looking, not committing -- someone deciding whether to
// sign up doesn't have to enter the stepper to see what's currently
// live.
export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const org = await defaultOrganization();
  const events = org ? await openEventsForSignup(org.id) : [];

  const byCategory = new Map<string, { name: string; events: typeof events }>();
  const uncategorized: typeof events = [];
  for (const ev of events) {
    if (ev.category) {
      const bucket = byCategory.get(ev.category.id) ?? { name: ev.category.name, events: [] };
      bucket.events.push(ev);
      byCategory.set(ev.category.id, bucket);
    } else {
      uncategorized.push(ev);
    }
  }

  return (
    <>
      <AppTopbar section="Browse" />
      <main className="rounds-shell">
        <section className="rounds-hero">
          <h1>What&apos;s open right now</h1>
          <p>Everything currently live for signup, grouped the same way as the signup form.</p>
        </section>

        {events.length === 0 ? (
          <Card>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              Nothing&apos;s open for signup right now — check back later.
            </p>
          </Card>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-6)" }}>
            {[...byCategory.values(), ...(uncategorized.length ? [{ name: "Other", events: uncategorized }] : [])].map(
              (bucket) => (
                <div key={bucket.name}>
                  <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-2)" }}>
                    {bucket.name}
                  </h2>
                  <div style={{ display: "grid", gap: "var(--space-3)" }}>
                    {bucket.events.map((ev) => (
                      <Card key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
                        <div>
                          <strong>{ev.name}</strong>
                          <p style={{ margin: "2px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                            {formatHolidayDate(new Date(ev.serviceStartsAt))}
                          </p>
                        </div>
                        <Badge tone="accent">{formatCentsShort(ev.priceCents)}</Badge>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            )}
            <a href="/signup">
              <Card className="card--interactive" style={{ textAlign: "center" }}>
                <strong>Ready to sign up?</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  Head to the signup form →
                </p>
              </Card>
            </a>
          </div>
        )}
      </main>
    </>
  );
}
