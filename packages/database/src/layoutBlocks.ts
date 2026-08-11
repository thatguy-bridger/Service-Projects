// SPEC.md §11.3: layout blocks -- "a fixed set of slots per screen, a
// fixed set of blocks per slot, reorder and toggle only." Pure types +
// normalization, no Prisma -- shared between the scoped write path
// (events.ts's updateEventStopCardLayout/updateEventRouteScreenLayout),
// the volunteer read path (visits.ts's myRouteDetail), and the app's
// editor/rendering code, so none of them duplicate "what blocks exist,
// which are required."
//
// Event.layoutBlocks stores every event-scoped screen's layout keyed
// by screen name: { volunteer_stop_card?: ScreenLayout, volunteer_
// route?: ScreenLayout }. Before the route screen shipped, this column
// held a bare ScreenLayout ({slots:{...}}) for the stop card directly
// -- extractScreenRaw below still reads that old shape for
// volunteer_stop_card so an admin's already-saved layout survives
// without a data migration.
//
// Only the volunteer stop card and route screen are implemented so
// far. The admin dashboard, public form, and event landing screens
// SPEC.md §11.3 also lists are covered separately once each has a real
// screen to attach blocks to.

export interface BlockInstance {
  blockId: string;
  visible: boolean;
}

export interface ScreenLayout {
  slots: Record<string, BlockInstance[]>;
}

export type EventScreenName = "volunteer_stop_card" | "volunteer_route";

function isBlockInstanceLike(value: unknown): value is { blockId: unknown; visible: unknown } {
  return !!value && typeof value === "object" && "blockId" in value;
}

/** Pulls one screen's raw layout JSON out of Event.layoutBlocks, with a fallback for the pre-route-screen bare shape. */
function extractScreenRaw(raw: unknown, screen: EventScreenName): unknown {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (screen in obj) return obj[screen];
  if (screen === "volunteer_stop_card" && "slots" in obj) return obj; // legacy bare shape
  return null;
}

/**
 * Builds a normalizer for one screen's registry: unknown block ids are
 * dropped (SPEC.md §11.3 -- "unknown ids render nothing and log,"
 * here there's simply nothing registered to render for them), a block
 * saved under the wrong slot is moved back to its real one, missing/
 * duplicate blocks are filled in from the registry so every block
 * appears exactly once, and every required block is forced visible
 * regardless of what was saved.
 */
function makeNormalizer<TSlot extends string>(
  slots: readonly TSlot[],
  blocks: { id: string; slot: TSlot; required: boolean }[],
  defaultLayout: ScreenLayout
) {
  const blocksById = new Map(blocks.map((b) => [b.id, b]));

  return function normalize(rawScreen: unknown): ScreenLayout {
    const rawSlots =
      rawScreen && typeof rawScreen === "object" && "slots" in rawScreen && (rawScreen as { slots: unknown }).slots
        ? (rawScreen as { slots: Record<string, unknown> }).slots
        : {};

    const seen = new Set<string>();
    const result: Record<string, BlockInstance[]> = Object.fromEntries(slots.map((s) => [s, []]));

    for (const slot of slots) {
      const entries = Array.isArray(rawSlots[slot]) ? (rawSlots[slot] as unknown[]) : [];
      for (const entry of entries) {
        if (!isBlockInstanceLike(entry) || typeof entry.blockId !== "string") continue;
        const meta = blocksById.get(entry.blockId);
        if (!meta || meta.slot !== slot || seen.has(meta.id)) continue;
        seen.add(meta.id);
        result[slot].push({ blockId: meta.id, visible: meta.required ? true : !!entry.visible });
      }
    }

    for (const meta of blocks) {
      if (seen.has(meta.id)) continue;
      const defaultVisible = defaultLayout.slots[meta.slot]?.find((b) => b.blockId === meta.id)?.visible ?? true;
      result[meta.slot].push({ blockId: meta.id, visible: meta.required ? true : defaultVisible });
    }

    return { slots: result };
  };
}

// ---------------------------------------------------------------------
// Volunteer stop card

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

// Exported so callers validating a bare ScreenLayout payload before
// save (events.ts) don't need to round-trip it through the full
// Event.layoutBlocks JSON shape just to reuse this normalizer.
export const normalizeStopCard = makeNormalizer(STOP_CARD_SLOTS, STOP_CARD_BLOCKS, DEFAULT_STOP_CARD_LAYOUT);

export function normalizeStopCardLayout(raw: unknown): ScreenLayout {
  return normalizeStopCard(extractScreenRaw(raw, "volunteer_stop_card"));
}

// ---------------------------------------------------------------------
// Volunteer route screen

// SPEC.md §11.3 names three slots (peek/sheet/header) for a bottom-
// sheet-over-map mobile pattern this app doesn't build (no map on this
// screen -- Navigate already hands off to the device's own maps app,
// see RouteRunner.tsx). Approximated as a plain top-to-bottom layout
// instead: header (top bar), peek (a prominent "what's next" summary,
// always visible), sheet (everything else, scrollable) -- same three
// named slots, a flat-page rendering of them rather than a real
// swipeable sheet.
export const ROUTE_SCREEN_SLOTS = ["header", "peek", "sheet"] as const;
export type RouteScreenSlot = (typeof ROUTE_SCREEN_SLOTS)[number];

export interface RouteScreenBlockMeta {
  id: string;
  slot: RouteScreenSlot;
  required: boolean;
  label: string;
}

// SPEC.md §11.3's route-screen block list. All seven now have a real
// data source: next-stop/progress-bar/stop-list are derived from the
// route's own stops (no new data needed), briefing reads Route.
// briefingMd (new column, this pass), distance-summary is computed
// client-side from consecutive stop coordinates, offline-status reads
// navigator.onLine, and coordinator-contact is a real query for this
// event's active Coordinator membership.
export const ROUTE_SCREEN_BLOCKS: RouteScreenBlockMeta[] = [
  { id: "progress_bar", slot: "header", required: true, label: "Progress" },
  { id: "next_stop", slot: "peek", required: true, label: "Next stop" },
  { id: "stop_list", slot: "sheet", required: true, label: "Stop list" },
  { id: "briefing", slot: "sheet", required: false, label: "Route briefing" },
  { id: "distance_summary", slot: "sheet", required: false, label: "Distance summary" },
  { id: "coordinator_contact", slot: "sheet", required: false, label: "Coordinator contact" },
  { id: "offline_status", slot: "sheet", required: false, label: "Offline status" },
];

export const DEFAULT_ROUTE_SCREEN_LAYOUT: ScreenLayout = {
  slots: {
    header: [{ blockId: "progress_bar", visible: true }],
    peek: [{ blockId: "next_stop", visible: true }],
    sheet: [
      { blockId: "stop_list", visible: true },
      { blockId: "briefing", visible: true },
      { blockId: "distance_summary", visible: false },
      { blockId: "coordinator_contact", visible: false },
      { blockId: "offline_status", visible: false },
    ],
  },
};

export const normalizeRouteScreen = makeNormalizer(ROUTE_SCREEN_SLOTS, ROUTE_SCREEN_BLOCKS, DEFAULT_ROUTE_SCREEN_LAYOUT);

export function normalizeRouteScreenLayout(raw: unknown): ScreenLayout {
  return normalizeRouteScreen(extractScreenRaw(raw, "volunteer_route"));
}

/**
 * Merges one screen's newly-saved layout into the existing
 * Event.layoutBlocks JSON without clobbering the other screens' saved
 * layouts (or the legacy bare stop-card shape, which gets upgraded to
 * the keyed shape the first time any screen is saved on that event).
 */
export function mergeEventLayout(existing: unknown, screen: EventScreenName, layout: ScreenLayout): Record<string, ScreenLayout> {
  const base: Record<string, ScreenLayout> = {};
  if (existing && typeof existing === "object") {
    const obj = existing as Record<string, unknown>;
    if ("volunteer_stop_card" in obj && obj.volunteer_stop_card && typeof obj.volunteer_stop_card === "object" && "slots" in (obj.volunteer_stop_card as object)) {
      base.volunteer_stop_card = normalizeStopCard(obj.volunteer_stop_card);
    } else if ("slots" in obj) {
      // legacy bare shape
      base.volunteer_stop_card = normalizeStopCard(obj);
    }
    if ("volunteer_route" in obj) {
      base.volunteer_route = normalizeRouteScreen(obj.volunteer_route);
    }
  }
  base[screen] = layout;
  return base;
}
