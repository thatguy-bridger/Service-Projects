import { describe, it, expect } from "vitest";
import { reorderSlot } from "./dashboardReorder";
import type { ScreenLayout } from "@service-projects/database/layoutBlocks";

const layout: ScreenLayout = {
  slots: {
    top: [
      { blockId: "needs_review_count", visible: true },
      { blockId: "unassigned_stops", visible: true },
    ],
    main: [
      { blockId: "todays_routes", visible: true },
      { blockId: "live_progress", visible: true },
      { blockId: "subscription_funnel", visible: false },
    ],
    side: [{ blockId: "recent_audit", visible: true }],
  },
};

describe("reorderSlot", () => {
  it("moves a block to sit where another visible block currently is, within the same slot", () => {
    const result = reorderSlot(layout, "main", "live_progress", "todays_routes");
    expect(result.slots.main.filter((b) => b.visible).map((b) => b.blockId)).toEqual(["live_progress", "todays_routes"]);
  });

  it("leaves hidden blocks in the slot, unaffected by the reorder", () => {
    const result = reorderSlot(layout, "main", "live_progress", "todays_routes");
    expect(result.slots.main.find((b) => b.blockId === "subscription_funnel")).toEqual({
      blockId: "subscription_funnel",
      visible: false,
    });
  });

  it("doesn't touch other slots", () => {
    const result = reorderSlot(layout, "main", "live_progress", "todays_routes");
    expect(result.slots.top).toEqual(layout.slots.top);
    expect(result.slots.side).toEqual(layout.slots.side);
  });

  it("is a no-op when dropped on itself", () => {
    const result = reorderSlot(layout, "main", "todays_routes", "todays_routes");
    expect(result).toBe(layout);
  });

  it("is a no-op for a block id that isn't in this slot (e.g. a stale drag from another slot)", () => {
    const result = reorderSlot(layout, "main", "needs_review_count", "todays_routes");
    expect(result).toBe(layout);
  });
});
