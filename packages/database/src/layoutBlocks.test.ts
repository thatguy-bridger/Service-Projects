import { describe, it, expect } from "vitest";
import { normalizeStopCardLayout, DEFAULT_STOP_CARD_LAYOUT, STOP_CARD_BLOCKS } from "./layoutBlocks";

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
});
