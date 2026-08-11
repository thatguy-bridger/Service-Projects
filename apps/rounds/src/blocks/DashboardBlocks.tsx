import type { ReactNode } from "react";
import { Badge } from "@service-projects/ui";
import type {
  ScreenLayout,
  AdminDashboardSlot,
  AdminDashboardRoute as DashboardRoute,
  AdminDashboardAuditEntry as DashboardAuditEntry,
} from "@service-projects/database/layoutBlocks";

// SPEC.md §11.3's admin dashboard. "renewal campaign status" is
// deliberately not a block here -- renewal campaigns aren't built
// anywhere in this app, so there's no data for it (see layoutBlocks.ts).
export interface AdminDashboardBlockData {
  needsReviewCount: number;
  unassignedStopsCount: number;
  subscriptionFunnel: { status: string; count: number }[];
  todaysRoutes: DashboardRoute[];
  recentAudit: DashboardAuditEntry[];
}

function StatTile({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <a href={href} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <p style={{ margin: "0 0 4px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>{count}</p>
    </a>
  );
}

function renderBlock(blockId: string, data: AdminDashboardBlockData): ReactNode {
  switch (blockId) {
    case "needs_review_count":
      return <StatTile label="Needs review" count={data.needsReviewCount} href="/admin/review" />;
    case "unassigned_stops":
      return <StatTile label="Unassigned stops" count={data.unassignedStopsCount} href="/admin/events" />;
    case "subscription_funnel":
      return data.subscriptionFunnel.length ? (
        <div className="card">
          <p style={{ margin: "0 0 8px", fontWeight: "var(--weight-semibold)" }}>Subscription funnel</p>
          <div style={{ display: "grid", gap: 4 }}>
            {data.subscriptionFunnel.map((f) => (
              <div key={f.status} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{f.status}</span>
                <span style={{ fontWeight: "var(--weight-medium)" }}>{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null;
    case "todays_routes":
      return (
        <div className="card">
          <p style={{ margin: "0 0 8px", fontWeight: "var(--weight-semibold)" }}>Today&apos;s routes</p>
          {data.todaysRoutes.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
              No events scheduled for today.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {data.todaysRoutes.map((r) => (
                <a
                  key={r.id}
                  href={`/admin/events/${r.eventId}`}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", color: "inherit" }}
                >
                  <span>
                    {r.name} — <span style={{ color: "var(--text-secondary)" }}>{r.eventName}</span>
                  </span>
                  <Badge tone={r.status === "in_progress" ? "accent" : "neutral"}>{r.status}</Badge>
                </a>
              ))}
            </div>
          )}
        </div>
      );
    case "live_progress": {
      const inProgress = data.todaysRoutes.filter((r) => r.status === "in_progress");
      return inProgress.length ? (
        <div className="card">
          <p style={{ margin: "0 0 8px", fontWeight: "var(--weight-semibold)" }}>Live progress</p>
          <div style={{ display: "grid", gap: 4 }}>
            {inProgress.map((r) => (
              <a
                key={r.id}
                href={`/admin/events/${r.eventId}/board`}
                style={{ fontSize: "var(--text-sm)", color: "var(--color-accent-600)" }}
              >
                {r.name} ({r.eventName}) — live board →
              </a>
            ))}
          </div>
        </div>
      ) : null;
    }
    case "recent_audit":
      return data.recentAudit.length ? (
        <div className="card">
          <p style={{ margin: "0 0 8px", fontWeight: "var(--weight-semibold)" }}>Recent activity</p>
          <div style={{ display: "grid", gap: 4 }}>
            {data.recentAudit.map((a, i) => (
              <p key={i} style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {a.action.replace(/_/g, " ").replace(/\./g, " · ")} — {new Date(a.at).toLocaleString()}
              </p>
            ))}
          </div>
        </div>
      ) : null;
    default:
      // SPEC.md §11.3: "Unknown ids render nothing and log."
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[layoutBlocks] unknown admin-dashboard block id "${blockId}"`);
      }
      return null;
  }
}

export function AdminDashboardSlotBlocks({
  layout,
  slot,
  data,
}: {
  layout: ScreenLayout;
  slot: AdminDashboardSlot;
  data: AdminDashboardBlockData;
}) {
  const blocks = (layout.slots[slot] ?? []).filter((b) => b.visible);
  return (
    <>
      {blocks.map((b) => (
        <span key={b.blockId} style={{ display: "contents" }}>
          {renderBlock(b.blockId, data)}
        </span>
      ))}
    </>
  );
}
