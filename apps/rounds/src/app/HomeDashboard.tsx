"use client";

import { useState } from "react";
import { Button } from "@service-projects/ui";
import type { ScreenLayout, AdminDashboardSlot } from "@service-projects/database/layoutBlocks";
import { renderAdminDashboardBlock, type AdminDashboardBlockData } from "@/blocks/DashboardBlocks";
import { updateAdminDashboardLayoutAction } from "./admin/settings/actions";
import { reorderSlot } from "@/lib/dashboardReorder";

const TOP_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "var(--space-4)",
  marginBottom: "var(--space-6)",
};

const COLUMN_GRID: React.CSSProperties = { display: "grid", gap: "var(--space-4)" };

/**
 * The homepage's own drag-to-reorder for admin-dashboard blocks --
 * complements (doesn't replace) the /admin/settings editor, which is
 * still where visibility toggling and "reset to default" live. This
 * only reorders within a slot: SPEC.md §11.3's blocks are each
 * permanently bound to one slot (needs_review_count is always "top",
 * etc, enforced by layoutBlocks.ts's normalizer), so dragging a block
 * to a different slot isn't a supported move -- it would just get
 * silently moved back on the next save.
 */
export function HomeDashboard({
  initialLayout,
  data,
}: {
  initialLayout: ScreenLayout;
  data: AdminDashboardBlockData;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [rearranging, setRearranging] = useState(false);
  const [dragging, setDragging] = useState<{ slot: AdminDashboardSlot; blockId: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function persist(next: ScreenLayout) {
    setLayout(next);
    setSaving(true);
    await updateAdminDashboardLayoutAction(next);
    setSaving(false);
  }

  function handleDrop(slot: AdminDashboardSlot, toBlockId: string) {
    if (dragging && dragging.slot === slot && dragging.blockId !== toBlockId) {
      persist(reorderSlot(layout, slot, dragging.blockId, toBlockId));
    }
    setDragging(null);
  }

  function renderSlot(slot: AdminDashboardSlot, gridStyle: React.CSSProperties) {
    const blocks = (layout.slots[slot] ?? []).filter((b) => b.visible);
    if (blocks.length === 0) return null;
    return (
      <div style={gridStyle}>
        {blocks.map((b) => (
          <div
            key={b.blockId}
            draggable={rearranging}
            onDragStart={() => setDragging({ slot, blockId: b.blockId })}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => rearranging && e.preventDefault()}
            onDrop={(e) => {
              if (!rearranging) return;
              e.preventDefault();
              handleDrop(slot, b.blockId);
            }}
            onClickCapture={(e) => {
              if (rearranging) e.preventDefault();
            }}
            style={{
              cursor: rearranging ? "grab" : undefined,
              opacity: dragging?.blockId === b.blockId ? 0.4 : 1,
              outline: rearranging ? "2px dashed var(--border-strong)" : "2px dashed transparent",
              outlineOffset: 4,
              borderRadius: "var(--radius-lg)",
              transition: "opacity var(--duration-fast) var(--ease-standard)",
            }}
          >
            {renderAdminDashboardBlock(b.blockId, data)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "var(--space-3)",
          marginBottom: "var(--space-3)",
        }}
      >
        {saving && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Saving…</span>}
        {rearranging && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            Drag a card to reorder it within its section
          </span>
        )}
        <Button type="button" variant={rearranging ? "primary" : "secondary"} onClick={() => setRearranging((v) => !v)}>
          {rearranging ? "Done rearranging" : "Rearrange"}
        </Button>
      </div>

      {renderSlot("top", TOP_GRID)}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-4)", alignItems: "start" }}>
        {renderSlot("main", COLUMN_GRID)}
        {renderSlot("side", COLUMN_GRID)}
      </div>
    </div>
  );
}
