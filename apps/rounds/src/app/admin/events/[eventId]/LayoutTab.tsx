"use client";

import { useState } from "react";
import { Button, Card, Badge } from "@service-projects/ui";
import {
  STOP_CARD_SLOTS,
  STOP_CARD_BLOCKS,
  DEFAULT_STOP_CARD_LAYOUT,
  ROUTE_SCREEN_SLOTS,
  ROUTE_SCREEN_BLOCKS,
  DEFAULT_ROUTE_SCREEN_LAYOUT,
  type ScreenLayout,
  type StopCardSlot,
  type RouteScreenSlot,
} from "@service-projects/database/layoutBlocks";
import { StopCardSlotBlocks, type StopCardData } from "@/blocks/StopCardBlocks";
import { RouteScreenSlotBlocks, renderRouteScreenBlock, type RouteScreenData } from "@/blocks/RouteScreenBlocks";
import { updateEventStopCardLayoutAction, updateEventRouteScreenLayoutAction } from "./actions";

function moveBlock<TSlot extends string>(layout: ScreenLayout, slot: TSlot, index: number, direction: -1 | 1): ScreenLayout {
  const blocks = [...(layout.slots[slot] ?? [])];
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return layout;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { slots: { ...layout.slots, [slot]: blocks } };
}

function toggleBlock<TSlot extends string>(layout: ScreenLayout, slot: TSlot, blockId: string): ScreenLayout {
  const blocks = (layout.slots[slot] ?? []).map((b) => (b.blockId === blockId ? { ...b, visible: !b.visible } : b));
  return { slots: { ...layout.slots, [slot]: blocks } };
}

// Shared editor: a list of slots, each with its blocks -- checkbox to
// toggle visibility (locked on for required blocks), up/down buttons
// to reorder within the slot (SPEC.md §11.3's "keyboard alternative"
// to drag-to-reorder). Generic over which screen's slots/blocks it's
// editing so the stop-card and route-screen editors don't duplicate
// this markup.
function BlockEditor<TSlot extends string>({
  slots,
  slotLabels,
  blocks,
  layout,
  onChange,
}: {
  slots: readonly TSlot[];
  slotLabels: Record<TSlot, string>;
  blocks: { id: string; slot: TSlot; required: boolean; label: string }[];
  layout: ScreenLayout;
  onChange: (next: ScreenLayout) => void;
}) {
  const blockMeta = new Map(blocks.map((b) => [b.id, b]));

  return (
    <>
      {slots.map((slot) => (
        <Card key={slot} style={{ padding: "var(--space-4)" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)" }}>
            {slotLabels[slot]}
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
                      onChange={() => onChange(toggleBlock(layout, slot, instance.blockId))}
                    />
                    <span>{meta.label}</span>
                    {meta.required && <Badge tone="neutral">Required</Badge>}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={i === 0}
                    aria-label={`Move ${meta.label} up`}
                    onClick={() => onChange(moveBlock(layout, slot, i, -1))}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={i === (layout.slots[slot]?.length ?? 0) - 1}
                    aria-label={`Move ${meta.label} down`}
                    onClick={() => onChange(moveBlock(layout, slot, i, 1))}
                  >
                    ↓
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
}

const STOP_CARD_SLOT_LABELS: Record<StopCardSlot, string> = {
  primary: "Primary",
  secondary: "Secondary",
  actions: "Actions",
};

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

function StopCardLayoutEditor({ eventId, initialLayout }: { eventId: string; initialLayout: ScreenLayout }) {
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
          <a href="/my-routes" style={{ color: "var(--color-accent-500)" }}>
            My routes
          </a>
          . Address can&apos;t be hidden — a stop card without it isn&apos;t useful to anyone.
        </p>
        <BlockEditor
          slots={STOP_CARD_SLOTS}
          slotLabels={STOP_CARD_SLOT_LABELS}
          blocks={STOP_CARD_BLOCKS}
          layout={layout}
          onChange={setLayout}
        />
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

const ROUTE_SCREEN_SLOT_LABELS: Record<RouteScreenSlot, string> = {
  header: "Header",
  peek: "Peek (always visible)",
  sheet: "Sheet (scrollable)",
};

// Same stand-in-data idea as PREVIEW_STOP above, for the route screen.
const PREVIEW_ROUTE_DATA: RouteScreenData = {
  doneCount: 2,
  totalCount: 5,
  nextStop: { addressLine: "742 Evergreen Terrace", sequence: 3 },
  briefingMd: "Park at the church lot on Main St. Check in with the coordinator before starting.",
  distanceMeters: 3200,
  coordinatorContact: { name: "Jane Doe", email: "jane@example.com" },
  isOffline: false,
};

function RouteScreenLayoutEditor({ eventId, initialLayout }: { eventId: string; initialLayout: ScreenLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    const result = await updateEventRouteScreenLayoutAction(eventId, layout);
    setSaving(false);
    setSaved(result.ok);
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
          What a volunteer sees on the route screen in{" "}
          <a href="/my-routes" style={{ color: "var(--color-accent-500)" }}>
            My routes
          </a>
          . SPEC.md §11.3 describes this as a map with a bottom sheet — this app doesn&apos;t have that map yet, so
          it renders top-to-bottom instead: header, then peek (always visible), then sheet (scrollable). Progress,
          next stop, and the stop list itself can&apos;t be hidden.
        </p>
        <BlockEditor
          slots={ROUTE_SCREEN_SLOTS}
          slotLabels={ROUTE_SCREEN_SLOT_LABELS}
          blocks={ROUTE_SCREEN_BLOCKS}
          layout={layout}
          onChange={setLayout}
        />
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button type="button" variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setLayout(DEFAULT_ROUTE_SCREEN_LAYOUT)}>
            Reset to default
          </Button>
        </div>
        {saved && <p style={{ color: "var(--color-success-500)", margin: 0 }}>Saved.</p>}
      </div>

      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)" }}>
          Preview as volunteer
        </h3>
        <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
          <RouteScreenSlotBlocks layout={layout} slot="header" data={PREVIEW_ROUTE_DATA} />
          <RouteScreenSlotBlocks layout={layout} slot="peek" data={PREVIEW_ROUTE_DATA} />
          {(layout.slots.sheet ?? [])
            .filter((b) => b.visible)
            .map((b) => (
              <div key={b.blockId}>
                {b.blockId === "stop_list" ? (
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                    (stop cards render here, same as the stop-card layout above)
                  </p>
                ) : (
                  renderRouteScreenBlock(b.blockId, PREVIEW_ROUTE_DATA)
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function LayoutTab({
  eventId,
  stopCardLayout,
  routeScreenLayout,
}: {
  eventId: string;
  stopCardLayout: ScreenLayout;
  routeScreenLayout: ScreenLayout;
}) {
  const [screen, setScreen] = useState<"stop_card" | "route_screen">("stop_card");

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab${screen === "stop_card" ? " admin-tab--active" : ""}`}
          onClick={() => setScreen("stop_card")}
        >
          Stop card
        </button>
        <button
          type="button"
          className={`admin-tab${screen === "route_screen" ? " admin-tab--active" : ""}`}
          onClick={() => setScreen("route_screen")}
        >
          Route screen
        </button>
      </div>
      {screen === "stop_card" ? (
        <StopCardLayoutEditor eventId={eventId} initialLayout={stopCardLayout} />
      ) : (
        <RouteScreenLayoutEditor eventId={eventId} initialLayout={routeScreenLayout} />
      )}
    </div>
  );
}
