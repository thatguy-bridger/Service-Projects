import type { ReactNode } from "react";
import { Badge } from "@service-projects/ui";
import type { ScreenLayout, RouteScreenSlot } from "@service-projects/database/layoutBlocks";

// SPEC.md §11.3's volunteer route screen. "stop_list" is deliberately
// NOT rendered here -- it needs the parent's interactive state
// (recording an outcome, which stop is mid-save), not just data, so
// RouteRunner.tsx special-cases that one blockId directly and renders
// everything else in the "sheet" slot through this registry, same
// split as StopCardBlocks.tsx keeping interactive controls (Navigate,
// outcome buttons) outside the block system entirely.
export interface RouteScreenData {
  doneCount: number;
  totalCount: number;
  nextStop: { addressLine: string; sequence: number | null } | null;
  briefingMd: string | null;
  distanceMeters: number | null;
  coordinatorContact: { name: string; email: string } | null;
  isOffline: boolean;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(1)} mi`;
}

/** Exported so RouteRunner.tsx can interleave the (non-block) stop
 * list with these in the exact saved order, instead of always
 * rendering the list first. */
export function renderRouteScreenBlock(blockId: string, data: RouteScreenData): ReactNode {
  switch (blockId) {
    case "progress_bar":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              background: "var(--surface-muted, #e5e7eb)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: data.totalCount ? `${Math.round((data.doneCount / data.totalCount) * 100)}%` : "0%",
                height: "100%",
                background: "var(--color-accent-500)",
              }}
            />
          </div>
          <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", whiteSpace: "nowrap" }}>
            {data.doneCount}/{data.totalCount} done
          </span>
        </div>
      );
    case "next_stop":
      return data.nextStop ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Next: <strong>{data.nextStop.addressLine}</strong>
        </p>
      ) : null;
    case "briefing":
      return data.briefingMd ? (
        <div className="card" style={{ padding: "var(--space-3)" }}>
          <p style={{ margin: "0 0 4px", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-sm)" }}>
            Route briefing
          </p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>
            {data.briefingMd}
          </p>
        </div>
      ) : null;
    case "distance_summary":
      return data.distanceMeters != null ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Approx. {formatDistance(data.distanceMeters)} between stops, in order
        </p>
      ) : null;
    case "coordinator_contact":
      return data.coordinatorContact ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Coordinator: {data.coordinatorContact.name} —{" "}
          <a href={`mailto:${data.coordinatorContact.email}`} style={{ color: "var(--color-accent-600)" }}>
            {data.coordinatorContact.email}
          </a>
        </p>
      ) : null;
    case "offline_status":
      return data.isOffline ? <Badge tone="warning">Offline — changes will sync once reconnected</Badge> : null;
    default:
      // SPEC.md §11.3: "Unknown ids render nothing and log."
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[layoutBlocks] unknown route-screen block id "${blockId}"`);
      }
      return null;
  }
}

export function RouteScreenSlotBlocks({
  layout,
  slot,
  data,
  skipBlockIds = [],
}: {
  layout: ScreenLayout;
  slot: RouteScreenSlot;
  data: RouteScreenData;
  skipBlockIds?: string[];
}) {
  const blocks = (layout.slots[slot] ?? []).filter((b) => b.visible && !skipBlockIds.includes(b.blockId));
  return (
    <>
      {blocks.map((b) => (
        <span key={b.blockId} style={{ display: "contents" }}>
          {renderRouteScreenBlock(b.blockId, data)}
        </span>
      ))}
    </>
  );
}
