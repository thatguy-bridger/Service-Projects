import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventForSession, routesForEvent, stopsForSession } from "@service-projects/database";
import { BoardAutoRefresh } from "../BoardAutoRefresh";

// SPEC.md §21 Phase 8: "Live progress board and wall display." Lives
// under the same OWNER/ADMIN-gated /admin/* layout as everything else
// (real auth for free -- a wall display still shouldn't be a public
// URL), but keeps its own content large and glanceable: total stops, a
// status breakdown, a per-route progress bar, auto-refreshing itself
// (BoardAutoRefresh) instead of anyone having to reload it. No realtime
// infra (websockets/SSE) -- a 15s self-refresh is "current enough" for
// a board someone glances at, not a collaborative editing surface.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DONE: "Done",
  SKIPPED: "Skipped",
  ISSUE: "Issue",
  IN_PROGRESS: "In progress",
  ASSIGNED: "Assigned",
  UNASSIGNED: "Unassigned",
};

const STATUS_COLOR: Record<string, string> = {
  DONE: "var(--color-success-500)",
  SKIPPED: "var(--color-warning-500)",
  ISSUE: "var(--color-danger-500)",
  IN_PROGRESS: "var(--color-info-500)",
  ASSIGNED: "var(--color-gray-400)",
  UNASSIGNED: "var(--color-gray-300)",
};

export default async function EventBoardPage({ params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) notFound();

  const event = await eventForSession(session, org.id, params.eventId);
  if (!event) notFound();

  const [stops, routes] = await Promise.all([
    stopsForSession(session, params.eventId),
    routesForEvent(session, params.eventId),
  ]);

  const total = stops.length;
  const counts: Record<string, number> = {};
  for (const s of stops) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const attempted = (counts.DONE ?? 0) + (counts.SKIPPED ?? 0) + (counts.ISSUE ?? 0);
  const pctAttempted = total > 0 ? Math.round((attempted / total) * 100) : 0;

  const stopsByRoute = new Map<string, typeof stops>();
  for (const s of stops) {
    if (!s.routeId) continue;
    const list = stopsByRoute.get(s.routeId) ?? [];
    list.push(s);
    stopsByRoute.set(s.routeId, list);
  }

  return (
    <>
      <BoardAutoRefresh />
      <div>
        <h1 style={{ fontSize: "var(--text-3xl)", margin: "0 0 4px" }}>{event.name}</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-lg)", margin: "0 0 var(--space-8)" }}>
          {total} stop{total === 1 ? "" : "s"} · {pctAttempted}% attempted
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
          {Object.keys(STATUS_LABEL).map((status) => (
            <div
              key={status}
              style={{
                padding: "var(--space-5)",
                borderRadius: "var(--radius-lg)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border-default)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--weight-semibold)", color: STATUS_COLOR[status] }}>
                {counts[status] ?? 0}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4 }}>
                {STATUS_LABEL[status]}
              </div>
            </div>
          ))}
        </div>

        {routes.length > 0 && (
          <div>
            <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>Routes</h2>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {routes.map((route) => {
                const routeStops = stopsByRoute.get(route.id) ?? [];
                const routeDone = routeStops.filter((s) => s.status === "DONE" || s.status === "SKIPPED" || s.status === "ISSUE").length;
                const pct = routeStops.length > 0 ? Math.round((routeDone / routeStops.length) * 100) : 0;
                return (
                  <div key={route.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                    <span style={{ width: 160, fontWeight: "var(--weight-medium)" }}>{route.name}</span>
                    <div style={{ flex: 1, height: 16, borderRadius: "var(--radius-full)", background: "var(--surface-sunken)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: route.color, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ width: 90, textAlign: "right", color: "var(--text-secondary)" }}>
                      {routeDone}/{routeStops.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
