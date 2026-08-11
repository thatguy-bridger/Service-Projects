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

export type EventScreenName = "volunteer_stop_card" | "volunteer_route" | "event_landing";

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
    if ("event_landing" in obj) {
      base.event_landing = normalizeEventLanding(obj.event_landing);
    }
  }
  base[screen] = layout;
  return base;
}

// ---------------------------------------------------------------------
// Admin dashboard

// Org-scoped, not per-event (SPEC.md §11.3 says layouts are "per event,
// inheriting from an org default" -- there's no single event in
// context for an admin's home screen, so this one only has the org
// tier; stored in Organization.settings.layoutBlocks.admin_dashboard,
// not Event.layoutBlocks).
export const ADMIN_DASHBOARD_SLOTS = ["top", "main", "side"] as const;
export type AdminDashboardSlot = (typeof ADMIN_DASHBOARD_SLOTS)[number];

export interface AdminDashboardBlockMeta {
  id: string;
  slot: AdminDashboardSlot;
  required: boolean;
  label: string;
}

// SPEC.md §11.3's admin-dashboard block list, minus "renewal campaign
// status" -- renewal campaigns aren't built anywhere in this app yet,
// so there's no data source for that block. The other six all have a
// real one (dashboard.ts's adminDashboardData).
export const ADMIN_DASHBOARD_BLOCKS: AdminDashboardBlockMeta[] = [
  { id: "needs_review_count", slot: "top", required: false, label: "Needs review" },
  { id: "unassigned_stops", slot: "top", required: false, label: "Unassigned stops" },
  { id: "subscription_funnel", slot: "main", required: false, label: "Subscription funnel" },
  { id: "todays_routes", slot: "main", required: false, label: "Today's routes" },
  { id: "live_progress", slot: "main", required: false, label: "Live progress" },
  { id: "recent_audit", slot: "side", required: false, label: "Recent activity" },
];

export const DEFAULT_ADMIN_DASHBOARD_LAYOUT: ScreenLayout = {
  slots: {
    top: [
      { blockId: "needs_review_count", visible: true },
      { blockId: "unassigned_stops", visible: true },
    ],
    main: [
      { blockId: "subscription_funnel", visible: false },
      { blockId: "todays_routes", visible: true },
      { blockId: "live_progress", visible: true },
    ],
    side: [{ blockId: "recent_audit", visible: true }],
  },
};

export const normalizeAdminDashboard = makeNormalizer(ADMIN_DASHBOARD_SLOTS, ADMIN_DASHBOARD_BLOCKS, DEFAULT_ADMIN_DASHBOARD_LAYOUT);

export function normalizeAdminDashboardLayout(raw: unknown): ScreenLayout {
  if (raw && typeof raw === "object" && "admin_dashboard" in raw) {
    return normalizeAdminDashboard((raw as { admin_dashboard: unknown }).admin_dashboard);
  }
  return normalizeAdminDashboard(null);
}

/**
 * Plain data shapes for the admin-dashboard blocks (see
 * scoped/dashboard.ts's adminDashboardData, which returns these). Declared
 * here rather than in dashboard.ts because dashboard.ts imports Prisma --
 * client components need these types without pulling that in, same reason
 * the block registries above live in this Prisma-free file.
 */
export interface AdminDashboardRoute {
  id: string;
  name: string;
  eventId: string;
  eventName: string;
  status: string;
}

export interface AdminDashboardAuditEntry {
  action: string;
  entity: string;
  at: string;
}

// ---------------------------------------------------------------------
// Public form (org-scoped)

// SPEC.md §11.3 describes this per-event, but the real /signup flow
// lets a volunteer select several events (holidays) in one submission
// -- there's no single event to key a layout on. So this is org-scoped
// (stored on Organization.settings, same as admin_dashboard) and wraps
// the whole signup stepper as a header/footer band, rather than one
// event's form. "sponsor_logos" is left out: no sponsor data exists
// anywhere in this app yet.
export const PUBLIC_FORM_SLOTS = ["header", "footer"] as const;
export type PublicFormSlot = (typeof PUBLIC_FORM_SLOTS)[number];

export interface PublicFormBlockMeta {
  id: string;
  slot: PublicFormSlot;
  required: boolean;
  label: string;
}

export const PUBLIC_FORM_BLOCKS: PublicFormBlockMeta[] = [
  { id: "cover_image", slot: "header", required: false, label: "Cover image" },
  { id: "description", slot: "header", required: false, label: "Description" },
  { id: "dates", slot: "header", required: false, label: "Dates" },
  { id: "price_summary", slot: "header", required: false, label: "Price summary" },
  { id: "privacy_notice", slot: "footer", required: true, label: "Privacy notice" },
];

export const DEFAULT_PUBLIC_FORM_LAYOUT: ScreenLayout = {
  slots: {
    header: [
      { blockId: "cover_image", visible: true },
      { blockId: "description", visible: true },
      { blockId: "dates", visible: true },
      { blockId: "price_summary", visible: true },
    ],
    footer: [{ blockId: "privacy_notice", visible: true }],
  },
};

export const normalizePublicForm = makeNormalizer(PUBLIC_FORM_SLOTS, PUBLIC_FORM_BLOCKS, DEFAULT_PUBLIC_FORM_LAYOUT);

export function normalizePublicFormLayout(raw: unknown): ScreenLayout {
  if (raw && typeof raw === "object" && "public_form" in raw) {
    return normalizePublicForm((raw as { public_form: unknown }).public_form);
  }
  return normalizePublicForm(null);
}

/** Representative single-event data the public-form header blocks render against -- the org's next open event (soonest serviceStartsAt). */
export interface PublicFormFeaturedEvent {
  name: string;
  summary: string | null;
  coverImageUrl: string | null;
  serviceStartsAt: string;
  priceCents: number;
}

// ---------------------------------------------------------------------
// Event landing (per event)

// Unlike public_form, event landing genuinely is about one event -- a
// teaser page (SPEC.md §11.3: hero, description, price, signup CTA)
// that links into the multi-event /signup flow rather than being the
// signup itself. "sponsor_logos", "faq", and "map of service area" are
// left out: no sponsor/FAQ content model and no map rendering exists
// anywhere in this app yet.
export const EVENT_LANDING_SLOTS = ["hero", "body", "footer"] as const;
export type EventLandingSlot = (typeof EVENT_LANDING_SLOTS)[number];

export interface EventLandingBlockMeta {
  id: string;
  slot: EventLandingSlot;
  required: boolean;
  label: string;
}

export const EVENT_LANDING_BLOCKS: EventLandingBlockMeta[] = [
  { id: "hero", slot: "hero", required: true, label: "Hero" },
  { id: "description", slot: "body", required: false, label: "Description" },
  { id: "event_date", slot: "body", required: false, label: "Event date" },
  { id: "price_table", slot: "body", required: false, label: "Price table" },
  { id: "signup_cta", slot: "footer", required: true, label: "Signup CTA" },
];

export const DEFAULT_EVENT_LANDING_LAYOUT: ScreenLayout = {
  slots: {
    hero: [{ blockId: "hero", visible: true }],
    body: [
      { blockId: "description", visible: true },
      { blockId: "event_date", visible: true },
      { blockId: "price_table", visible: true },
    ],
    footer: [{ blockId: "signup_cta", visible: true }],
  },
};

export const normalizeEventLanding = makeNormalizer(EVENT_LANDING_SLOTS, EVENT_LANDING_BLOCKS, DEFAULT_EVENT_LANDING_LAYOUT);

export function normalizeEventLandingLayout(raw: unknown): ScreenLayout {
  return normalizeEventLanding(extractScreenRaw(raw, "event_landing"));
}
