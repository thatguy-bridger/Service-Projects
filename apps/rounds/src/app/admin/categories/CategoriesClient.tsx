"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { createCategoryAction, saveCategoryRowAction, deleteCategoriesAction } from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  eventCount: number;
}

const columns: DataTableColumn<CategoryRow>[] = [
  { key: "name", label: "Name", getValue: (r) => r.name, editable: true },
  { key: "slug", label: "Slug", getValue: (r) => r.slug },
  { key: "eventCount", label: "Events", getValue: (r) => String(r.eventCount) },
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
