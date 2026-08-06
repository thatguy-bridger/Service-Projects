"use client";

import { useState, useTransition } from "react";
import { Button, DataTable, type DataTableColumn } from "@service-projects/ui";
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
  const [rows, setRows] = useState(initialRows);
  const [name, setName] = useState("");
  const [creating, startCreate] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);

  function handleCreate() {
    if (!name.trim()) return;
    startCreate(async () => {
      const result = await createCategoryAction(name);
      if (result.ok) {
        setName("");
        // Server actions here revalidatePath, but this page's data was
        // fetched once server-side before hydration -- simplest correct
        // refresh without a second data-fetch wire-up is a hard reload.
        window.location.reload();
      } else {
        setCreateError(result.error ?? "Couldn't create category.");
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", alignItems: "flex-start" }}>
        <input
          className="signup-input"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="button" variant="primary" disabled={creating} onClick={handleCreate}>
          {creating ? "Creating…" : "Create category"}
        </Button>
      </div>
      {createError && <p className="signup-error">{createError}</p>}

      <DataTable<CategoryRow>
        rows={rows}
        columns={columns}
        csvFilenamePrefix="categories"
        emptyMessage="No categories yet — create one above."
        onSaveRow={async (id, patch) => {
          const result = await saveCategoryRowAction(id, patch);
          if (result.ok) {
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: patch.name ?? r.name } : r)));
          }
          return result;
        }}
        onDeleteSelected={async (ids) => {
          const result = await deleteCategoriesAction(ids);
          setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
          return result;
        }}
      />
    </div>
  );
}
