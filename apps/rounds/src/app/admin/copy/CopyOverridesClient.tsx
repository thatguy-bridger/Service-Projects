"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { setCopyOverrideAction } from "./actions";

export interface CopyRow {
  id: string; // the copy key itself -- keys are unique by construction (one object literal)
  defaultValue: string;
  currentValue: string;
  overridden: boolean;
}

const columns: DataTableColumn<CopyRow>[] = [
  { key: "id", label: "Key", getValue: (r) => r.id },
  { key: "defaultValue", label: "Default (code)", getValue: (r) => r.defaultValue },
  {
    key: "currentValue",
    label: "Current text",
    getValue: (r) => r.currentValue,
    editable: true,
  },
  { key: "overridden", label: "Overridden?", getValue: (r) => (r.overridden ? "Yes" : "No") },
];

export function CopyOverridesClient({ initialRows }: { initialRows: CopyRow[] }) {
  return (
    <DataTable<CopyRow>
      rows={initialRows}
      columns={columns}
      csvFilenamePrefix="copy-overrides"
      emptyMessage="No copy keys found."
      onSaveRow={(key, patch) =>
        patch.currentValue !== undefined
          ? setCopyOverrideAction(key, patch.currentValue)
          : Promise.resolve({ ok: true })
      }
    />
  );
}
