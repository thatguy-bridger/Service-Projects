"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  getValue: (row: T) => string;
  editable?: boolean;
  inputType?: "text" | "number" | "date";
  selectOptions?: string[];
}

export interface DataTableSaveResult {
  ok: boolean;
  error?: string;
}

export interface DataTableImportResult {
  imported: number;
  errors: { row: number; reason: string }[];
}

/**
 * A generic, reusable admin table: every column shown, a per-column text
 * filter, row selection with a bulk-action toolbar (copy selected rows as
 * a downloaded + clipboard-copied CSV, delete selected, import a CSV from
 * the clipboard), and click-to-edit rows. Every consumer just supplies
 * column definitions (each knows how to read its own value off a row) and
 * a few optional async handlers -- the table owns all the interaction
 * state itself.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onSaveRow,
  onDeleteSelected,
  onImportCsv,
  onAddRow,
  onSelectionChange,
  csvFilenamePrefix = "export",
  emptyMessage = "Nothing here yet.",
  deleteLabel = "Delete selected data",
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  onSaveRow?: (id: string, patch: Record<string, string>) => Promise<DataTableSaveResult>;
  onDeleteSelected?: (ids: string[]) => Promise<{ deleted: number }>;
  deleteLabel?: string;
  onImportCsv?: (csvText: string) => Promise<DataTableImportResult>;
  // Adds a new row -- opens a blank form of every editable column. On
  // success the caller is responsible for getting the new row back into
  // `rows` (a router refresh or local state update); this component
  // doesn't own the row list, it's always a prop.
  onAddRow?: (values: Record<string, string>) => Promise<DataTableSaveResult>;
  // Lets a page build its own extra bulk action (e.g. "copy selected
  // into event X") alongside the built-in toolbar, without this
  // component needing to know about it.
  onSelectionChange?: (ids: string[]) => void;
  csvFilenamePrefix?: string;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<DataTableImportResult | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addValues, setAddValues] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [copyModal, setCopyModal] = useState<{ filename: string; rowCount: number } | null>(null);

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim().length > 0);
    if (activeFilters.length === 0) return rows;
    return rows.filter((row) =>
      activeFilters.every(([key, needle]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        return col.getValue(row).toLowerCase().includes(needle.toLowerCase());
      })
    );
  }, [rows, columns, filters]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = allVisibleSelected ? new Set<string>() : new Set(filteredRows.map((r) => r.id));
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  function rowsToCsv(targetRows: T[]): string {
    const header = columns.map((c) => csvCell(c.label)).join(",");
    const body = targetRows.map((row) => columns.map((c) => csvCell(c.getValue(row))).join(","));
    return [header, ...body].join("\r\n");
  }

  async function handleCopySelected() {
    const targetRows = filteredRows.filter((r) => selected.has(r.id));
    if (targetRows.length === 0) return;
    const csv = rowsToCsv(targetRows);

    // A real, distinct file every time -- not just clipboard text -- so
    // "saves a different csv file each time" is literal: a counter
    // persisted per table (by csvFilenamePrefix) survives across copies.
    const counterKey = `datatable-copy-count:${csvFilenamePrefix}`;
    const nextCount = Number(window.localStorage.getItem(counterKey) ?? "0") + 1;
    window.localStorage.setItem(counterKey, String(nextCount));
    const filename = `${csvFilenamePrefix}-${nextCount}.csv`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    try {
      await navigator.clipboard.writeText(csv);
    } catch {
      // Clipboard permission can be denied -- the downloaded file still
      // succeeded, so this isn't fatal, just one fewer way to get the data.
    }

    setCopyModal({ filename, rowCount: targetRows.length });
  }

  async function handleDeleteSelected() {
    if (!onDeleteSelected || selected.size === 0) return;
    setDeleting(true);
    try {
      await onDeleteSelected(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function openImport() {
    setImportResult(null);
    setImportText("");
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) setImportText(clip);
    } catch {
      // Clipboard read can be denied -- the modal's textarea still takes
      // a manual paste.
    }
    setImportOpen(true);
  }

  async function handleImport() {
    if (!onImportCsv || !importText.trim()) return;
    setImporting(true);
    try {
      const result = await onImportCsv(importText);
      setImportResult(result);
      if (result.imported > 0) router.refresh();
    } finally {
      setImporting(false);
    }
  }

  function startEdit(row: T) {
    setSaveError(null);
    setEditingId(row.id);
    const values: Record<string, string> = {};
    for (const col of columns) if (col.editable) values[col.key] = col.getValue(row);
    setEditValues(values);
  }

  async function saveEdit(id: string) {
    if (!onSaveRow) return;
    setSavingId(id);
    setSaveError(null);
    try {
      const result = await onSaveRow(id, editValues);
      if (result.ok) {
        setEditingId(null);
        router.refresh();
      } else {
        setSaveError(result.error ?? "Save failed.");
      }
    } finally {
      setSavingId(null);
    }
  }

  function openAdd() {
    setAddError(null);
    const blank: Record<string, string> = {};
    for (const col of columns) if (col.editable) blank[col.key] = col.selectOptions?.[0] ?? "";
    setAddValues(blank);
    setAddOpen(true);
  }

  async function handleAdd() {
    if (!onAddRow) return;
    setAdding(true);
    setAddError(null);
    try {
      const result = await onAddRow(addValues);
      if (result.ok) {
        setAddOpen(false);
        router.refresh();
      } else {
        setAddError(result.error ?? "Couldn't add row.");
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        {onAddRow && (
          <Button type="button" variant="primary" onClick={openAdd}>
            Add row
          </Button>
        )}
        {selected.size > 0 && (
          <>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {selected.size} selected
            </span>
            <Button type="button" variant="secondary" onClick={handleCopySelected}>
              Copy selected data
            </Button>
            {onDeleteSelected && (
              <Button type="button" variant="danger" disabled={deleting} onClick={handleDeleteSelected}>
                {deleting ? "Working…" : deleteLabel}
              </Button>
            )}
          </>
        )}
        {onImportCsv && (
          <Button type="button" variant="secondary" onClick={openImport}>
            Import copied data
          </Button>
        )}
      </div>

      <div className="admin-tableWrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              {columns.map((col) => (
                <th key={col.key} style={thStyle}>
                  {col.label}
                </th>
              ))}
              <th style={thStyle} />
            </tr>
            <tr>
              <th style={thStyle} />
              {columns.map((col) => (
                <th key={col.key} style={{ ...thStyle, paddingTop: 0 }}>
                  <input
                    className="signup-input"
                    style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-2)" }}
                    placeholder="Filter…"
                    value={filters[col.key] ?? ""}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                  />
                </th>
              ))}
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} style={{ ...tdStyle, color: "var(--text-muted)" }}>
                  {emptyMessage}
                </td>
              </tr>
            )}
            {filteredRows.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <tr key={row.id} className="admin-tableRow">
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`Select row ${row.id}`}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} style={tdStyle}>
                      {isEditing && col.editable ? (
                        col.selectOptions ? (
                          <select
                            className="signup-input"
                            value={editValues[col.key] ?? ""}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                          >
                            {col.selectOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="signup-input"
                            type={col.inputType ?? "text"}
                            value={editValues[col.key] ?? ""}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                          />
                        )
                      ) : (
                        col.getValue(row)
                      )}
                    </td>
                  ))}
                  <td style={tdStyle}>
                    {onSaveRow &&
                      (isEditing ? (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <Button type="button" variant="primary" disabled={savingId === row.id} onClick={() => saveEdit(row.id)}>
                            {savingId === row.id ? "Saving…" : "Save"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" variant="secondary" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveError && (
        <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
          {saveError}
        </p>
      )}

      {copyModal && (
        <div className="dialog-backdrop" onClick={() => setCopyModal(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Copied</h2>
            <p className="dialog-body">
              {copyModal.rowCount} row{copyModal.rowCount === 1 ? "" : "s"} downloaded as{" "}
              <strong>{copyModal.filename}</strong> and copied to your clipboard as CSV — paste it anywhere, or use
              "Import copied data" to bring it back into a table.
            </p>
            <div className="dialog-actions">
              <Button type="button" variant="primary" onClick={() => setCopyModal(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="dialog-backdrop" onClick={() => setImportOpen(false)}>
          <div className="dialog" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Import data</h2>
            <p className="dialog-body">
              Paste CSV data below — pre-filled from your clipboard if it had any. The first row must be column
              headers matching {columns.map((c) => c.label).join(", ")}.
            </p>
            <textarea
              className="signup-input"
              style={{ width: "100%", minHeight: 200, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importResult && (
              <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                Imported {importResult.imported} row{importResult.imported === 1 ? "" : "s"}.
                {importResult.errors.length > 0 && (
                  <>
                    {" "}
                    {importResult.errors.length} row{importResult.errors.length === 1 ? "" : "s"} skipped:{" "}
                    {importResult.errors.map((e) => `row ${e.row} (${e.reason})`).join("; ")}
                  </>
                )}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>
                Close
              </Button>
              <Button type="button" variant="primary" disabled={importing || !importText.trim()} onClick={handleImport}>
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="dialog-backdrop" onClick={() => setAddOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Add row</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
              {columns
                .filter((c) => c.editable)
                .map((col) => (
                  <label key={col.key} className="signup-field">
                    <span className="signup-fieldLabel">{col.label}</span>
                    {col.selectOptions ? (
                      <select
                        className="signup-input"
                        value={addValues[col.key] ?? ""}
                        onChange={(e) => setAddValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      >
                        {col.selectOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="signup-input"
                        type={col.inputType ?? "text"}
                        value={addValues[col.key] ?? ""}
                        onChange={(e) => setAddValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
            </div>
            {addError && (
              <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
                {addError}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" disabled={adding} onClick={handleAdd}>
                {adding ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  fontWeight: "var(--weight-medium)" as unknown as number,
};

const tdStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-sm)",
};
