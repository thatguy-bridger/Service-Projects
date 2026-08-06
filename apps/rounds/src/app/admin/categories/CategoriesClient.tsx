"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { createCategoryAction, saveCategoryRowAction, deleteCategoriesAction } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  eventCount: number;
  priceCents: number | null;
}

// Blank bundle price = charge each event's own price and sum the
// selection; a set price here charges that flat amount once for any
// subset of this category's events (see Subscription.categoryId).
const columns: DataTableColumn<CategoryRow>[] = [
  { key: "name", label: "Name", getValue: (r) => r.name, editable: true },
  { key: "slug", label: "Slug", getValue: (r) => r.slug },
  { key: "eventCount", label: "Events", getValue: (r) => String(r.eventCount) },
  {
    key: "priceCents",
    label: "Bundle price ($, blank = sum of events)",
    getValue: (r) => (r.priceCents === null ? "" : (r.priceCents / 100).toFixed(2)),
    editable: true,
    inputType: "number",
  },
];

export function CategoriesClient({ initialRows }: { initialRows: CategoryRow[] }) {
  return (
    <DataTable<CategoryRow>
      rows={initialRows}
      columns={columns}
      csvFilenamePrefix="categories"
      emptyMessage="No categories yet — add one with the button above."
      onSaveRow={(id, patch) => saveCategoryRowAction(id, patch)}
      onDeleteSelected={(ids) => deleteCategoriesAction(ids)}
      onAddRow={(values) => createCategoryAction(values.name ?? "")}
    />
  );
}
