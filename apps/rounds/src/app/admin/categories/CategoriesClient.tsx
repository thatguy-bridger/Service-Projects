"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { createCategoryAction, saveCategoryRowAction, deleteCategoriesAction } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  eventCount: number;
  priceCents: number | null;
  publishedAt: string | null;
}

const PUBLISHED = "Published";
const NOT_PUBLISHED = "Not published";

// Blank bundle price = charge each event's own price and sum the
// selection; a set price here charges that flat amount once for any
// subset of this category's events (see Subscription.categoryId).
//
// Publishing is category-level now, not per-event (Category.publishedAt
// -- see the scoped helper): publishing a category is the one action
// that puts every OPEN event in it on public signup, and also bulk-
// opens any of its events still sitting in DRAFT so a freshly-added
// event doesn't need a separate manual flip. Modeled as an editable
// select here (same inline-edit UX as every other column) rather than a
// dedicated button, so publish/unpublish, rename, and price all go
// through the one familiar row-edit flow.
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
  {
    key: "published",
    label: "Signup status",
    getValue: (r) => (r.publishedAt ? PUBLISHED : NOT_PUBLISHED),
    editable: true,
    selectOptions: [NOT_PUBLISHED, PUBLISHED],
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
