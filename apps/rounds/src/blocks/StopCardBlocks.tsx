import type { ReactNode } from "react";
import type { ScreenLayout, StopCardSlot } from "@service-projects/database/layoutBlocks";

// SPEC.md §11.3's volunteer stop card, rendered from a ScreenLayout
// instead of fixed JSX -- this is the one place that knows how to turn
// a blockId into markup, shared by the real route runner
// (RouteRunner.tsx) and the admin editor's live preview
// (LayoutTab.tsx), so they can never drift out of sync with each
// other.
export interface StopCardData {
  sequence: number | null;
  addressLine: string;
  label: string | null;
  placementNote: string | null;
  accessNotes: string | null;
  householdName: string | null;
  phone: string | null;
}

const SECONDARY_TEXT: React.CSSProperties = {
  margin: "4px 0 0",
  color: "var(--text-secondary)",
  fontSize: "var(--text-sm)",
};

function renderBlock(blockId: string, stop: StopCardData): ReactNode {
  switch (blockId) {
    case "sequence":
      return stop.sequence != null ? (
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Stop {stop.sequence}</p>
      ) : null;
    case "address":
      return <p style={{ margin: 0, fontWeight: "var(--weight-semibold)" }}>{stop.addressLine}</p>;
    case "label":
      return stop.label ? <p style={SECONDARY_TEXT}>{stop.label}</p> : null;
    case "placement_note":
      return stop.placementNote ? <p style={SECONDARY_TEXT}>{stop.placementNote}</p> : null;
    case "access_notes":
      return stop.accessNotes ? <p style={SECONDARY_TEXT}>{stop.accessNotes}</p> : null;
    case "household_name":
      return stop.householdName ? <p style={SECONDARY_TEXT}>{stop.householdName}</p> : null;
    case "phone":
      return stop.phone ? (
        <a href={`tel:${stop.phone}`} style={{ color: "var(--color-accent-600)", fontSize: "var(--text-sm)" }}>
          Call {stop.phone}
        </a>
      ) : null;
    default:
      // SPEC.md §11.3: "Unknown ids render nothing and log" -- a
      // removed/renamed block should never white-screen a volunteer.
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[layoutBlocks] unknown stop-card block id "${blockId}"`);
      }
      return null;
  }
}

export function StopCardSlotBlocks({
  layout,
  slot,
  stop,
}: {
  layout: ScreenLayout;
  slot: StopCardSlot;
  stop: StopCardData;
}) {
  const blocks = layout.slots[slot] ?? [];
  return (
    <>
      {blocks.filter((b) => b.visible).map((b) => (
        <span key={b.blockId} style={{ display: "contents" }}>
          {renderBlock(b.blockId, stop)}
        </span>
      ))}
    </>
  );
}
