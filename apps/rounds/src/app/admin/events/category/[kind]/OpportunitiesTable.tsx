"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { deleteOpportunitiesAction, saveOpportunityRowAction, addOpportunityAction } from "./actions";
import { EVENT_KINDS, EVENT_KIND_LABELS } from "@/lib/eventKinds";
import type { EventKind } from "@service-projects/database";

export interface OpportunityRow {
  id: string;
  name: string;
  serviceStartsAt: Date;
  status: string;
}

function toDateInput(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function OpportunitiesTable({
  opportunities,
  fixedKind = null,
  fixedCategoryId = null,
}: {
  opportunities: OpportunityRow[];
  fixedKind?: EventKind | null;
  fixedCategoryId?: string | null;
}) {
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
  ];

  return (
    <DataTable<OpportunityRow>
      rows={opportunities}
      columns={columns}
      csvFilenamePrefix="opportunities"
      emptyMessage="No opportunities yet."
      onSaveRow={(id, patch) => saveOpportunityRowAction(id, patch)}
      onDeleteSelected={(ids) => deleteOpportunitiesAction(ids)}
      onAddRow={(values) => {
        const kind = fixedKind ?? (EVENT_KINDS.find((k) => EVENT_KIND_LABELS[k] === values.kind) ?? null);
        return addOpportunityAction(kind, fixedCategoryId, values);
      }}
    />
  );
}
