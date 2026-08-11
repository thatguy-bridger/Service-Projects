"use client";

import { useState } from "react";
import { Button, Card, Badge } from "@service-projects/ui";
import {
  PUBLIC_FORM_SLOTS,
  PUBLIC_FORM_BLOCKS,
  DEFAULT_PUBLIC_FORM_LAYOUT,
  type ScreenLayout,
  type PublicFormSlot,
  type PublicFormFeaturedEvent,
} from "@service-projects/database/layoutBlocks";
import { PublicFormSlotBlocks } from "@/blocks/PublicFormBlocks";
import { updatePublicFormLayoutAction } from "./actions";

function moveBlock(layout: ScreenLayout, slot: PublicFormSlot, index: number, direction: -1 | 1): ScreenLayout {
  const blocks = [...(layout.slots[slot] ?? [])];
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return layout;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { slots: { ...layout.slots, [slot]: blocks } };
}

function toggleBlock(layout: ScreenLayout, slot: PublicFormSlot, blockId: string): ScreenLayout {
  const blocks = (layout.slots[slot] ?? []).map((b) => (b.blockId === blockId ? { ...b, visible: !b.visible } : b));
  return { slots: { ...layout.slots, [slot]: blocks } };
}

const SLOT_LABELS: Record<PublicFormSlot, string> = {
  header: "Header",
  footer: "Footer",
};

const PREVIEW_FEATURED: PublicFormFeaturedEvent = {
  name: "Fall Flags 2026",
  summary: "Flags placed the morning of, picked up that evening.",
  coverImageUrl: null,
  serviceStartsAt: new Date().toISOString(),
  priceCents: 3500,
};

export function PublicFormLayoutEditor({ initialLayout }: { initialLayout: ScreenLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const result = await updatePublicFormLayoutAction(layout);
    setSaving(false);
    setSaved(result.ok);
  }

  const blockMeta = new Map(PUBLIC_FORM_BLOCKS.map((b) => [b.id, b]));

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
          What wraps the signup form at <a href="/signup" style={{ color: "var(--color-accent-500)" }}>/signup</a>.
          The header blocks render against the soonest open event. The privacy notice can&apos;t be hidden.
        </p>
        {PUBLIC_FORM_SLOTS.map((slot) => (
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
          <Button type="button" variant="ghost" onClick={() => setLayout(DEFAULT_PUBLIC_FORM_LAYOUT)}>
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
          <PublicFormSlotBlocks layout={layout} slot="header" featured={PREVIEW_FEATURED} />
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            (signup stepper renders here)
          </p>
          <PublicFormSlotBlocks layout={layout} slot="footer" featured={PREVIEW_FEATURED} />
        </div>
      </div>
    </div>
  );
}
