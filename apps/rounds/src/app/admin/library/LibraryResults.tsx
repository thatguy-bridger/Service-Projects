"use client";

import { useState } from "react";
import { Button, DataTable, type DataTableColumn } from "@service-projects/ui";
import { t } from "@/copy";
import {
  saveHouseholdRowAction,
  deleteHouseholdsRowsAction,
  addHouseholdAction,
  copyToEventBySelection,
} from "./actions";
import type { HouseholdSortField } from "@service-projects/database";

export interface LibraryHousehold {
  id: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressInput: string;
  placementNote: string | null;
  accessNotes: string | null;
  createdAt: Date;
}

export interface EventOption {
  id: string;
  name: string;
}

const SORT_COLUMNS: { key: string; label: string; sortField: HouseholdSortField }[] = [
  { key: "contactName", label: "admin.library.table.name", sortField: "contactName" },
  { key: "contact", label: "admin.library.table.contact", sortField: "contactEmail" },
  { key: "addressInput", label: "admin.library.table.address", sortField: "addressInput" },
  { key: "createdAt", label: "admin.library.table.created", sortField: "createdAt" },
];

const columns: DataTableColumn<LibraryHousehold>[] = [
  { key: "contactName", label: "Name", getValue: (r) => r.contactName, editable: true },
  { key: "contactEmail", label: "Email", getValue: (r) => r.contactEmail ?? "", editable: true },
  { key: "contactPhone", label: "Phone", getValue: (r) => r.contactPhone ?? "", editable: true },
  { key: "addressInput", label: "Address", getValue: (r) => r.addressInput, editable: true },
  { key: "placementNote", label: "Placement note", getValue: (r) => r.placementNote ?? "", editable: true },
  { key: "accessNotes", label: "Access notes", getValue: (r) => r.accessNotes ?? "", editable: true },
  { key: "createdAt", label: "Created", getValue: (r) => new Date(r.createdAt).toLocaleDateString() },
];

export function LibraryResults({
  households,
  events,
  total,
  page,
  totalPages,
  query,
  sortBy,
  sortDir,
}: {
  households: LibraryHousehold[];
  events: EventOption[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  sortBy: HouseholdSortField;
  sortDir: "asc" | "desc";
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetEventId, setTargetEventId] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  function sortHref(field: HouseholdSortField) {
    const nextDir = sortBy === field && sortDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", field);
    params.set("dir", nextDir);
    return `?${params.toString()}`;
  }

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", sortBy);
    params.set("dir", sortDir);
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)", fontSize: "var(--text-xs)" }}>
        <span style={{ color: "var(--text-muted)" }}>Sort:</span>
        {SORT_COLUMNS.map((col) => (
          <a key={col.key} href={sortHref(col.sortField)} style={{ color: "inherit", textDecoration: "none" }}>
            {t(col.label)} {sortBy === col.sortField ? (sortDir === "asc" ? "▲" : "▼") : ""}
          </a>
        ))}
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-2)" }}>
        {t("admin.library.total", { count: total })}
      </p>

      <DataTable<LibraryHousehold>
        rows={households}
        columns={columns}
        csvFilenamePrefix="households"
        emptyMessage={t("admin.library.search.empty")}
        onSelectionChange={setSelectedIds}
        onSaveRow={(id, patch) => saveHouseholdRowAction(id, patch)}
        onDeleteSelected={(ids) => deleteHouseholdsRowsAction(ids)}
        onAddRow={(values) => addHouseholdAction(values)}
      />

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          {page > 1 && <a href={pageHref(page - 1)}>{t("admin.library.pagination.prev")}</a>}
          <span style={{ color: "var(--text-muted)" }}>
            {t("admin.library.pagination.status", { page, totalPages })}
          </span>
          {page < totalPages && <a href={pageHref(page + 1)}>{t("admin.library.pagination.next")}</a>}
        </div>
      )}

      {events.length > 0 && (
        <div className="admin-formRow" style={{ marginTop: "var(--space-4)" }}>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">{t("admin.library.eventLabel")}</span>
            <select
              className="signup-input"
              value={targetEventId}
              onChange={(e) => setTargetEventId(e.target.value)}
            >
              <option value="" disabled>
                {t("admin.library.eventPlaceholder")}
              </option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={copying || !targetEventId || selectedIds.length === 0}
            onClick={async () => {
              setCopying(true);
              setCopyMessage(null);
              const result = await copyToEventBySelection(targetEventId, selectedIds);
              setCopyMessage(result.error ?? `Copied ${result.copied} household${result.copied === 1 ? "" : "s"}.`);
              setCopying(false);
            }}
          >
            {copying ? t("admin.library.copying") : t("admin.library.copy")}
          </Button>
        </div>
      )}
      {copyMessage && (
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {copyMessage}
        </p>
      )}
    </>
  );
}
