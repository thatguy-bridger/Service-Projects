"use client";

import { useState } from "react";
import { Button, Card, Badge } from "@service-projects/ui";
import {
  STOP_CARD_SLOTS,
  STOP_CARD_BLOCKS,
  DEFAULT_STOP_CARD_LAYOUT,
  type ScreenLayout,
  type StopCardSlot,
} from "@service-projects/database/layoutBlocks";
import { StopCardSlotBlocks, type StopCardData } from "@/blocks/StopCardBlocks";
import { updateEventStopCardLayoutAction } from "./actions";

const SLOT_LABELS: Record<StopCardSlot, string> = {
  primary: "Primary",
  secondary: "Secondary",
  actions: "Actions",
};

const BLOCK_META = new Map(STOP_CARD_BLOCKS.map((b) => [b.id, b]));

// A stand-in stop used only for the preview panel -- never sent
// anywhere, just so an admin can see what a real card looks like with
// the layout they're currently editing (SPEC.md §11.3: "Preview as
// volunteer before saving").
const PREVIEW_STOP: StopCardData = {
  sequence: 3,
  addressLine: "742 Evergreen Terrace",
  label: "Corner lot",
  placementNote: "Left of the driveway, behind the mailbox",
  accessNotes: "Friendly dog, gate latch is stiff",
  householdName: "Jane Doe",
  phone: "555-0100",
};

function moveBlock(layout: ScreenLayout, slot: StopCardSlot, index: number, direction: -1 | 1): ScreenLayout {
  const blocks = [...(layout.slots[slot] ?? [])];
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return layout;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { slots: { ...layout.slots, [slot]: blocks } };
}

function toggleBlock(layout: ScreenLayout, slot: StopCardSlot, blockId: string): ScreenLayout {
  const blocks = (layout.slots[slot] ?? []).map((b) =>
    b.blockId === blockId ? { ...b, visible: !b.visible } : b
  );
  return { slots: { ...layout.slots, [slot]: blocks } };
}

export function LayoutTab({ eventId, initialLayout }: { eventId: string; initialLayout: ScreenLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const result = await updateEventStopCardLayoutAction(eventId, layout);
    setSaving(false);
    setSaved(result.ok);
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
          What a volunteer sees on each stop&apos;s card in{" "}
          <a href={`/my-routes`} style={{ color: "var(--color-accent-500)" }}>
            My routes
          </a>
          . Toggle a block on/off, reorder within its slot. Address can&apos;t be hidden — a stop card without it
          isn&apos;t useful to anyone.
        </p>

        {STOP_CARD_SLOTS.map((slot) => (
          <Card key={slot} style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)" }}>
              {SLOT_LABELS[slot]}
            </h3>
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {(layout.slots[slot] ?? []).map((instance, i) => {
                const meta = BLOCK_META.get(instance.blockId);
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
                        onChange={() => setLayout((prev) => toggleBlock(prev, slot, instance.blockId))}
                      />
                      <span>{meta.label}</span>
                      {meta.required && <Badge tone="neutral">Required</Badge>}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={i === 0}
                      aria-label={`Move ${meta.label} up`}
                      onClick={() => setLayout((prev) => moveBlock(prev, slot, i, -1))}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={i === (layout.slots[slot]?.length ?? 0) - 1}
                      aria-label={`Move ${meta.label} down`}
                      onClick={() => setLayout((prev) => moveBlock(prev, slot, i, 1))}
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
          <Button type="button" variant="ghost" onClick={() => setLayout(DEFAULT_STOP_CARD_LAYOUT)}>
            Reset to default
          </Button>
        </div>
        {saved && <p style={{ color: "var(--color-success-500)", margin: 0 }}>Saved.</p>}
      </div>

      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)" }}>
          Preview as volunteer
        </h3>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
            <div>
              <StopCardSlotBlocks layout={layout} slot="primary" stop={PREVIEW_STOP} />
              <StopCardSlotBlocks layout={layout} slot="secondary" stop={PREVIEW_STOP} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
            <Button type="button" variant="secondary" disabled>
              Navigate
            </Button>
            <StopCardSlotBlocks layout={layout} slot="actions" stop={PREVIEW_STOP} />
            <Button type="button" variant="primary" disabled>
              Placed
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
