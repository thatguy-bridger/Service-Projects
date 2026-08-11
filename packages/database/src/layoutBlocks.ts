// SPEC.md §11.3: layout blocks -- "a fixed set of slots per screen, a
// fixed set of blocks per slot, reorder and toggle only." Pure types +
// normalization, no Prisma -- shared between the scoped write path
// (events.ts's updateEventStopCardLayout), the volunteer read path
// (visits.ts's myRouteDetail), and the app's editor/rendering code, so
// none of them duplicate "what blocks exist, which are required."
//
// Only the volunteer stop card is implemented. The other four screens
// SPEC.md §11.3 lists (volunteer route, admin dashboard, public form,
// event landing) don't have a settled single-screen UI to attach
// blocks to yet in this app (no bottom-sheet route map, no dashboard
// home, no landing page distinct from signup) -- building their block
// registry now would mean guessing at blocks before the screen itself
// exists, exactly what §11.3 warns against for the editor. A real,
// deliberate scope line, not an oversight.

export interface BlockInstance {
  blockId: string;
  visible: boolean;
}

export interface ScreenLayout {
  slots: Record<string, BlockInstance[]>;
}

export const STOP_CARD_SLOTS = ["primary", "secondary", "actions"] as const;
export type StopCardSlot = (typeof STOP_CARD_SLOTS)[number];

export interface StopCardBlockMeta {
  id: string;
  slot: StopCardSlot;
  required: boolean;
  label: string;
}

// SPEC.md §11.3's stop-card block list, minus three that don't have
// real data behind them yet: "visible answers" (no form-builder/field-
// response model exists), "distance" (no client geolocation wired in),
// and "photo-of-house" (no photo upload/storage exists anywhere in
// this app). Adding them to the registry now would mean shipping a
// block that always renders empty -- deferred until each has a real
// data source, not silently dropped.
export const STOP_CARD_BLOCKS: StopCardBlockMeta[] = [
  { id: "sequence", slot: "primary", required: false, label: "Stop number" },
  { id: "address", slot: "primary", required: true, label: "Address" },
  { id: "label", slot: "secondary", required: false, label: "Label" },
  { id: "placement_note", slot: "secondary", required: false, label: "Placement note" },
  { id: "access_notes", slot: "secondary", required: false, label: "Access notes" },
  { id: "household_name", slot: "secondary", required: false, label: "Household name" },
  { id: "phone", slot: "actions", required: false, label: "Call household" },
];

const BLOCKS_BY_ID = new Map(STOP_CARD_BLOCKS.map((b) => [b.id, b]));

export const DEFAULT_STOP_CARD_LAYOUT: ScreenLayout = {
  slots: {
    primary: [
      { blockId: "sequence", visible: true },
      { blockId: "address", visible: true },
    ],
    secondary: [
      { blockId: "label", visible: true },
      { blockId: "placement_note", visible: true },
      { blockId: "access_notes", visible: true },
      { blockId: "household_name", visible: false },
    ],
    actions: [{ blockId: "phone", visible: false }],
  },
};

function isBlockInstanceLike(value: unknown): value is { blockId: unknown; visible: unknown } {
  return !!value && typeof value === "object" && "blockId" in value;
}

/**
 * Turns whatever's saved in Event.layoutBlocks (untrusted JSON, or
 * null for "use the default") into a real, safe ScreenLayout: unknown
 * block ids are dropped (SPEC.md §11.3 -- "unknown ids render nothing
 * and log," here there's simply nothing registered to render for
 * them), a block saved under the wrong slot is moved back to its real
 * one, missing/duplicate blocks are filled in from the registry so
 * every block appears exactly once, and every required block is
 * forced visible regardless of what was saved. Used both when reading
 * a layout for rendering and when validating one before it's saved --
 * a save always re-normalizes rather than trusting the client's shape.
 */
export function normalizeStopCardLayout(raw: unknown): ScreenLayout {
  const rawSlots =
    raw && typeof raw === "object" && "slots" in raw && (raw as { slots: unknown }).slots
      ? (raw as { slots: Record<string, unknown> }).slots
      : {};

  const seen = new Set<string>();
  const slots: Record<StopCardSlot, BlockInstance[]> = { primary: [], secondary: [], actions: [] };

  for (const slot of STOP_CARD_SLOTS) {
    const entries = Array.isArray(rawSlots[slot]) ? (rawSlots[slot] as unknown[]) : [];
    for (const entry of entries) {
      if (!isBlockInstanceLike(entry) || typeof entry.blockId !== "string") continue;
      const meta = BLOCKS_BY_ID.get(entry.blockId);
      if (!meta || meta.slot !== slot || seen.has(meta.id)) continue;
      seen.add(meta.id);
      slots[slot].push({ blockId: meta.id, visible: meta.required ? true : !!entry.visible });
    }
  }

  // Anything registered but missing from the saved layout (a block
  // added to the registry after this event's layout was last saved,
  // or a first-ever normalize of a null/garbage value) gets appended
  // using the default's visibility.
  for (const meta of STOP_CARD_BLOCKS) {
    if (seen.has(meta.id)) continue;
    const defaultVisible = DEFAULT_STOP_CARD_LAYOUT.slots[meta.slot]?.find((b) => b.blockId === meta.id)?.visible ?? true;
    slots[meta.slot].push({ blockId: meta.id, visible: meta.required ? true : defaultVisible });
  }

  return { slots };
}
