"use client";

import { useState } from "react";
import { Button, Card, Badge } from "@service-projects/ui";
import {
  ADMIN_DASHBOARD_SLOTS,
  ADMIN_DASHBOARD_BLOCKS,
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  type ScreenLayout,
  type AdminDashboardSlot,
} from "@service-projects/database/layoutBlocks";
import { AdminDashboardSlotBlocks, type AdminDashboardBlockData } from "@/blocks/DashboardBlocks";
import { updateAdminDashboardLayoutAction } from "./actions";

function moveBlock(layout: ScreenLayout, slot: AdminDashboardSlot, index: number, direction: -1 | 1): ScreenLayout {
  const blocks = [...(layout.slots[slot] ?? [])];
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return layout;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { slots: { ...layout.slots, [slot]: blocks } };
}

function toggleBlock(layout: ScreenLayout, slot: AdminDashboardSlot, blockId: string): ScreenLayout {
  const blocks = (layout.slots[slot] ?? []).map((b) => (b.blockId === blockId ? { ...b, visible: !b.visible } : b));
  return { slots: { ...layout.slots, [slot]: blocks } };
}

const SLOT_LABELS: Record<AdminDashboardSlot, string> = {
  top: "Top",
  main: "Main",
  side: "Side",
};

// Stand-in data for the "preview as it'll appear" panel -- never sent
// anywhere, same idea as PREVIEW_STOP/PREVIEW_ROUTE_DATA in LayoutTab.tsx.
const PREVIEW_DATA: AdminDashboardBlockData = {
  needsReviewCount: 4,
  unassignedStopsCount: 12,
  subscriptionFunnel: [
    { status: "active", count: 58 },
    { status: "paused", count: 6 },
  ],
  todaysRoutes: [{ id: "r1", name: "Route A", eventId: "e1", eventName: "Fall Flags 2026", status: "in_progress" }],
  recentAudit: [{ action: "household.updated", entity: "Household", at: new Date().toISOString() }],
};

export function DashboardLayoutEditor({ initialLayout }: { initialLayout: ScreenLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const result = await updateAdminDashboardLayoutAction(layout);
    setSaving(false);
    setSaved(result.ok);
  }

  const blockMeta = new Map(ADMIN_DASHBOARD_BLOCKS.map((b) => [b.id, b]));

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
          What an Owner/Admin sees on the home dashboard. None of these blocks are required — hide anything
          that isn&apos;t useful for how this org runs events.
        </p>
        {ADMIN_DASHBOARD_SLOTS.map((slot) => (
          <Card key={slot} style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)" }}>
              {SLOT_LABELS[slot]}
            </h3>
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {(layout.slots[slot] ?? []).map((instance, i) => {
                const meta = blockMeta.get(instance.blockId);
                if (!meta) return null;
                return (
                  <div
                    key={instance.blockId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-2) var(--space-3)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={instance.visible}
                        disabled={meta.required}
                        onChange={() => setLayout(toggleBlock(layout, slot, instance.blockId))}
                      />
                      <span>{meta.label}</span>
                      {meta.required && <Badge tone="neutral">Required</Badge>}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={i === 0}
                      aria-label={`Move ${meta.label} up`}
                      onClick={() => setLayout(moveBlock(layout, slot, i, -1))}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={i === (layout.slots[slot]?.length ?? 0) - 1}
                      aria-label={`Move ${meta.label} down`}
                      onClick={() => setLayout(moveBlock(layout, slot, i, 1))}
                    >
                      ↓
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button type="button" variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setLayout(DEFAULT_ADMIN_DASHBOARD_LAYOUT)}>
            Reset to default
          </Button>
        </div>
        {saved && <p style={{ color: "var(--color-success-500)", margin: 0 }}>Saved.</p>}
      </div>

      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)" }}>
          Preview
        </h3>
        <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <AdminDashboardSlotBlocks layout={layout} slot="top" data={PREVIEW_DATA} />
          </div>
          <AdminDashboardSlotBlocks layout={layout} slot="main" data={PREVIEW_DATA} />
          <AdminDashboardSlotBlocks layout={layout} slot="side" data={PREVIEW_DATA} />
        </div>
      </div>
    </div>
  );
}
