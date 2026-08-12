import type { ScreenLayout, AdminDashboardSlot } from "@service-projects/database/layoutBlocks";

/** Moves `fromBlockId` to sit where `toBlockId` currently is, within one
 * slot's *visible* blocks only -- hidden ones (toggled off in
 * /admin/settings) are left in place at the end, their relative order
 * doesn't matter since they never render. Used by HomeDashboard.tsx's
 * drag-to-reorder. */
export function reorderSlot(
  layout: ScreenLayout,
  slot: AdminDashboardSlot,
  fromBlockId: string,
  toBlockId: string
): ScreenLayout {
  const instances = layout.slots[slot] ?? [];
  const visible = instances.filter((b) => b.visible);
  const hidden = instances.filter((b) => !b.visible);
  const fromIndex = visible.findIndex((b) => b.blockId === fromBlockId);
  const toIndex = visible.findIndex((b) => b.blockId === toBlockId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return layout;
  const reordered = [...visible];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return { slots: { ...layout.slots, [slot]: [...reordered, ...hidden] } };
}
