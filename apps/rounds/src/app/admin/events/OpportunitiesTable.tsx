"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn, Button } from "@service-projects/ui";
import {
  deleteOpportunitiesAction,
  saveOpportunityRowAction,
  addOpportunityAction,
  setOpportunityCategoryAction,
  moveOpportunitiesToCategoryAction,
} from "./opportunityActions";
import { EVENT_KINDS, EVENT_KIND_LABELS } from "@/lib/eventKinds";
import type { EventKind } from "@service-projects/database";

export interface OpportunityRow {
  id: string;
  name: string;
  serviceStartsAt: Date;
  status: string;
  priceCents: number;
  categoryId?: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
}

function toDateInput(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

const UNCATEGORIZED_LABEL = "(Uncategorized)";

export function OpportunitiesTable({
  opportunities,
  fixedKind = null,
  fixedCategoryId = null,
  categories = [],
}: {
  opportunities: OpportunityRow[];
  fixedKind?: EventKind | null;
  fixedCategoryId?: string | null;
  categories?: CategoryOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveTargetId, setMoveTargetId] = useState<string>(UNCATEGORIZED_LABEL);
  const [moving, setMoving] = useState(false);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  // A quick-add here needs a `kind` (createEvent requires one, for its
  // module/outcome defaults) -- when this table isn't already scoped to
  // one (the by-category view can hold events of any kind), the add
  // form gets an extra "Kind" column that's editable only when adding
  // (empty getValue means it never shows real data in the table body).
  const columns: DataTableColumn<OpportunityRow>[] = [
    ...(fixedKind
      ? []
      : [
          {
            key: "kind",
            label: "Kind",
            getValue: () => "",
            editable: true,
            selectOptions: EVENT_KINDS.map((k) => EVENT_KIND_LABELS[k]),
          } satisfies DataTableColumn<OpportunityRow>,
        ]),
    { key: "name", label: "Name", getValue: (r) => r.name, editable: true },
    { key: "serviceStartsAt", label: "Date", getValue: (r) => toDateInput(r.serviceStartsAt), editable: true, inputType: "date" },
    {
      key: "status",
      label: "Status",
      getValue: (r) => r.status,
      editable: true,
      selectOptions: ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"],
    },
    { key: "priceCents", label: "Price ($)", getValue: (r) => (r.priceCents / 100).toFixed(2), editable: true, inputType: "number" },
    // Category is editable per-row here too, not just via the bulk move
    // control below -- either one calls the same scoped setEventCategory.
    {
      key: "category",
      label: "Category",
      getValue: (r) => (r.categoryId ? categoryNameById.get(r.categoryId) ?? UNCATEGORIZED_LABEL : UNCATEGORIZED_LABEL),
      editable: true,
      selectOptions: [UNCATEGORIZED_LABEL, ...categories.map((c) => c.name)],
    },
  ];

  return (
    <>
      <DataTable<OpportunityRow>
        rows={opportunities}
        columns={columns}
        csvFilenamePrefix="opportunities"
        emptyMessage="No opportunities yet — add one above, or use Create events / Import from last year on the main Events page."
        onSelectionChange={setSelectedIds}
        onSaveRow={(id, patch) => {
          if (patch.category !== undefined) {
            const categoryId = patch.category === UNCATEGORIZED_LABEL ? null : categoryIdByName.get(patch.category) ?? null;
            return setOpportunityCategoryAction(id, categoryId);
          }
          return saveOpportunityRowAction(id, patch);
        }}
        onDeleteSelected={(ids) => deleteOpportunitiesAction(ids)}
        onAddRow={(values) => {
          const kind = fixedKind ?? (EVENT_KINDS.find((k) => EVENT_KIND_LABELS[k] === values.kind) ?? null);
          return addOpportunityAction(kind, fixedCategoryId, values);
        }}
      />

      {categories.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select rows above to move them"}
          </span>
          <select
            className="signup-input"
            style={{ width: "auto" }}
            value={moveTargetId}
            onChange={(e) => setMoveTargetId(e.target.value)}
            disabled={selectedIds.length === 0}
          >
            <option value={UNCATEGORIZED_LABEL}>{UNCATEGORIZED_LABEL}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            disabled={selectedIds.length === 0 || moving}
            onClick={async () => {
              setMoving(true);
              const categoryId = moveTargetId === UNCATEGORIZED_LABEL ? null : moveTargetId;
              const result = await moveOpportunitiesToCategoryAction(selectedIds, categoryId);
              setMoveMessage(`Moved ${result.moved} event${result.moved === 1 ? "" : "s"}.`);
              setMoving(false);
            }}
          >
            {moving ? "Moving…" : "Move selected to category"}
          </Button>
          {moveMessage && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{moveMessage}</span>}
        </div>
      )}
    </>
  );
}
