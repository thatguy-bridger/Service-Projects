import { describe, it, expect } from "vitest";
import {
  normalizeStopCardLayout,
  normalizeRouteScreenLayout,
  normalizeAdminDashboardLayout,
  normalizeEventLandingLayout,
  normalizePublicFormLayout,
  mergeEventLayout,
  DEFAULT_STOP_CARD_LAYOUT,
  DEFAULT_ROUTE_SCREEN_LAYOUT,
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  DEFAULT_EVENT_LANDING_LAYOUT,
  DEFAULT_PUBLIC_FORM_LAYOUT,
  STOP_CARD_BLOCKS,
  ROUTE_SCREEN_BLOCKS,
  ADMIN_DASHBOARD_BLOCKS,
  EVENT_LANDING_BLOCKS,
  PUBLIC_FORM_BLOCKS,
} from "./layoutBlocks";

describe("normalizeStopCardLayout", () => {
  it("returns the default layout for null/garbage input", () => {
    expect(normalizeStopCardLayout(null)).toEqual(DEFAULT_STOP_CARD_LAYOUT);
    expect(normalizeStopCardLayout(undefined)).toEqual(DEFAULT_STOP_CARD_LAYOUT);
    expect(normalizeStopCardLayout("not an object")).toEqual(DEFAULT_STOP_CARD_LAYOUT);
    expect(normalizeStopCardLayout({})).toEqual(DEFAULT_STOP_CARD_LAYOUT);
  });

  it("every registered block appears exactly once across all slots", () => {
    const result = normalizeStopCardLayout(null);
    const allIds = Object.values(result.slots).flatMap((blocks) => blocks.map((b) => b.blockId));
    expect(allIds.sort()).toEqual(STOP_CARD_BLOCKS.map((b) => b.id).sort());
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("drops an unknown block id instead of keeping it", () => {
    const result = normalizeStopCardLayout({
      slots: { primary: [{ blockId: "made_up_block", visible: true }], secondary: [], actions: [] },
    });
    const allIds = Object.values(result.slots).flatMap((blocks) => blocks.map((b) => b.blockId));
    expect(allIds).not.toContain("made_up_block");
  });

  it("forces a required block visible even if the saved layout hid it", () => {
    const result = normalizeStopCardLayout({
      slots: { primary: [{ blockId: "address", visible: false }], secondary: [], actions: [] },
    });
    const address = result.slots.primary.find((b) => b.blockId === "address");
    expect(address?.visible).toBe(true);
  });

  it("moves a block back to its real slot if it was saved under the wrong one", () => {
    const result = normalizeStopCardLayout({
      slots: { primary: [], secondary: [{ blockId: "address", visible: true }], actions: [] },
    });
    expect(result.slots.secondary.find((b) => b.blockId === "address")).toBeUndefined();
    expect(result.slots.primary.find((b) => b.blockId === "address")).toBeDefined();
  });

  it("respects a real saved order and visibility for non-required blocks", () => {
    const result = normalizeStopCardLayout({
      slots: {
        primary: [
          { blockId: "address", visible: true },
          { blockId: "sequence", visible: false },
        ],
        secondary: [{ blockId: "household_name", visible: true }],
        actions: [{ blockId: "phone", visible: true }],
      },
    });
    expect(result.slots.primary.map((b) => b.blockId)).toEqual(["address", "sequence"]);
    expect(result.slots.primary.find((b) => b.blockId === "sequence")?.visible).toBe(false);
    expect(result.slots.secondary.find((b) => b.blockId === "household_name")?.visible).toBe(true);
    expect(result.slots.actions.find((b) => b.blockId === "phone")?.visible).toBe(true);
  });

  it("drops a duplicate entry for the same block id", () => {
    const result = normalizeStopCardLayout({
      slots: {
        primary: [
          { blockId: "address", visible: true },
          { blockId: "address", visible: false },
        ],
        secondary: [],
        actions: [],
      },
    });
    expect(result.slots.primary.filter((b) => b.blockId === "address")).toHaveLength(1);
  });

  it("appends a block missing from the saved layout using the default's visibility", () => {
    const result = normalizeStopCardLayout({
      slots: { primary: [{ blockId: "address", visible: true }], secondary: [], actions: [] },
    });
    expect(result.slots.primary.find((b) => b.blockId === "sequence")).toBeDefined();
    expect(result.slots.secondary.length).toBeGreaterThan(0);
    expect(result.slots.actions.length).toBeGreaterThan(0);
  });

  it("reads the pre-route-screen legacy bare shape ({slots:...} with no screen key)", () => {
    const legacy = { slots: { primary: [{ blockId: "address", visible: true }], secondary: [], actions: [] } };
    expect(normalizeStopCardLayout(legacy)).toEqual(normalizeStopCardLayout({ volunteer_stop_card: legacy }));
  });
});

describe("normalizeRouteScreenLayout", () => {
  it("returns the default for null input", () => {
    expect(normalizeRouteScreenLayout(null)).toEqual(DEFAULT_ROUTE_SCREEN_LAYOUT);
  });

  it("every registered block appears exactly once", () => {
    const result = normalizeRouteScreenLayout(null);
    const allIds = Object.values(result.slots).flatMap((blocks) => blocks.map((b) => b.blockId));
    expect(allIds.sort()).toEqual(ROUTE_SCREEN_BLOCKS.map((b) => b.id).sort());
  });

  it("forces progress_bar, next_stop, and stop_list visible even if hidden in the saved layout", () => {
    const result = normalizeRouteScreenLayout({
      volunteer_route: {
        slots: {
          header: [{ blockId: "progress_bar", visible: false }],
          peek: [{ blockId: "next_stop", visible: false }],
          sheet: [{ blockId: "stop_list", visible: false }],
        },
      },
    });
    expect(result.slots.header[0].visible).toBe(true);
    expect(result.slots.peek[0].visible).toBe(true);
    expect(result.slots.sheet.find((b) => b.blockId === "stop_list")?.visible).toBe(true);
  });

  it("ignores a volunteer_stop_card key when reading the route screen", () => {
    const result = normalizeRouteScreenLayout({ volunteer_stop_card: { slots: { primary: [], secondary: [], actions: [] } } });
    expect(result).toEqual(DEFAULT_ROUTE_SCREEN_LAYOUT);
  });
});

describe("mergeEventLayout", () => {
  it("adds the new screen without touching an already-saved other screen", () => {
    const existing = { volunteer_route: { slots: { header: [{ blockId: "progress_bar", visible: true }], peek: [], sheet: [] } } };
    const merged = mergeEventLayout(existing, "volunteer_stop_card", DEFAULT_STOP_CARD_LAYOUT);
    expect(merged.volunteer_route).toBeDefined();
    expect(merged.volunteer_stop_card).toEqual(DEFAULT_STOP_CARD_LAYOUT);
  });

  it("upgrades a legacy bare stop-card shape to the keyed shape", () => {
    const legacy = { slots: { primary: [{ blockId: "address", visible: true }], secondary: [], actions: [] } };
    const merged = mergeEventLayout(legacy, "volunteer_route", DEFAULT_ROUTE_SCREEN_LAYOUT);
    expect(merged.volunteer_stop_card).toBeDefined();
    expect(merged.volunteer_route).toEqual(DEFAULT_ROUTE_SCREEN_LAYOUT);
  });

  it("overwrites the same screen's own previous layout", () => {
    const existing = { volunteer_stop_card: DEFAULT_STOP_CARD_LAYOUT };
    const changed = { slots: { primary: [{ blockId: "address", visible: true }], secondary: [], actions: [] } };
    const merged = mergeEventLayout(existing, "volunteer_stop_card", changed);
    expect(merged.volunteer_stop_card).toEqual(changed);
  });
});

describe("STOP_CARD_BLOCKS / ROUTE_SCREEN_BLOCKS", () => {
  it("address is the only required stop-card block", () => {
    expect(STOP_CARD_BLOCKS.filter((b) => b.required).map((b) => b.id)).toEqual(["address"]);
  });

  it("progress_bar, next_stop, and stop_list are required route-screen blocks", () => {
    expect(ROUTE_SCREEN_BLOCKS.filter((b) => b.required).map((b) => b.id).sort()).toEqual(
      ["next_stop", "progress_bar", "stop_list"].sort()
    );
  });
});

describe("normalizeAdminDashboardLayout", () => {
  it("returns the default layout for null/garbage input", () => {
    expect(normalizeAdminDashboardLayout(null)).toEqual(DEFAULT_ADMIN_DASHBOARD_LAYOUT);
    expect(normalizeAdminDashboardLayout({ foo: "bar" })).toEqual(DEFAULT_ADMIN_DASHBOARD_LAYOUT);
  });

  it("reads the keyed admin_dashboard shape out of org settings", () => {
    const raw = {
      admin_dashboard: { slots: { top: [], main: [{ blockId: "todays_routes", visible: false }], side: [] } },
    };
    const result = normalizeAdminDashboardLayout(raw);
    expect(result.slots.main.find((b) => b.blockId === "todays_routes")?.visible).toBe(false);
  });

  it("has no required admin-dashboard blocks", () => {
    expect(ADMIN_DASHBOARD_BLOCKS.filter((b) => b.required)).toEqual([]);
  });
});

describe("normalizeEventLandingLayout", () => {
  it("returns the default layout for null/garbage input", () => {
    expect(normalizeEventLandingLayout(null)).toEqual(DEFAULT_EVENT_LANDING_LAYOUT);
    expect(normalizeEventLandingLayout({ foo: "bar" })).toEqual(DEFAULT_EVENT_LANDING_LAYOUT);
  });

  it("reads the keyed event_landing shape out of Event.layoutBlocks", () => {
    const raw = { event_landing: { slots: { hero: [], body: [{ blockId: "price_table", visible: false }], footer: [] } } };
    const result = normalizeEventLandingLayout(raw);
    expect(result.slots.body.find((b) => b.blockId === "price_table")?.visible).toBe(false);
  });

  it("hero and signup_cta are the only required blocks", () => {
    expect(EVENT_LANDING_BLOCKS.filter((b) => b.required).map((b) => b.id).sort()).toEqual(["hero", "signup_cta"]);
  });
});

describe("normalizePublicFormLayout", () => {
  it("returns the default layout for null/garbage input", () => {
    expect(normalizePublicFormLayout(null)).toEqual(DEFAULT_PUBLIC_FORM_LAYOUT);
  });

  it("reads the keyed public_form shape out of org settings", () => {
    const raw = { public_form: { slots: { header: [{ blockId: "cover_image", visible: false }], footer: [] } } };
    const result = normalizePublicFormLayout(raw);
    expect(result.slots.header.find((b) => b.blockId === "cover_image")?.visible).toBe(false);
  });

  it("privacy_notice is the only required block", () => {
    expect(PUBLIC_FORM_BLOCKS.filter((b) => b.required).map((b) => b.id)).toEqual(["privacy_notice"]);
  });
});

describe("mergeEventLayout with event_landing", () => {
  it("adds event_landing without touching already-saved stop-card/route-screen layouts", () => {
    const existing = { volunteer_stop_card: DEFAULT_STOP_CARD_LAYOUT, volunteer_route: DEFAULT_ROUTE_SCREEN_LAYOUT };
    const merged = mergeEventLayout(existing, "event_landing", DEFAULT_EVENT_LANDING_LAYOUT);
    expect(merged.volunteer_stop_card).toBeDefined();
    expect(merged.volunteer_route).toBeDefined();
    expect(merged.event_landing).toEqual(DEFAULT_EVENT_LANDING_LAYOUT);
  });

  it("preserves an already-saved event_landing layout when merging a different screen", () => {
    const existing = { event_landing: DEFAULT_EVENT_LANDING_LAYOUT };
    const merged = mergeEventLayout(existing, "volunteer_stop_card", DEFAULT_STOP_CARD_LAYOUT);
    expect(merged.event_landing).toEqual(DEFAULT_EVENT_LANDING_LAYOUT);
  });
});
