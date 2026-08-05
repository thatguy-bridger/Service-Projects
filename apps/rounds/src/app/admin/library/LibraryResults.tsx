"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { copyToEvent, deleteHouseholdsAction } from "./actions";
import type { CopyToEventResult, DeleteResult, HouseholdSortField } from "@service-projects/database";

const copyInitialState: CopyToEventResult = { copied: 0 };
const deleteInitialState: DeleteResult = { deleted: 0, errors: [] };

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

const COLUMNS = [
  { key: "contactName", label: "admin.library.table.name", sortField: "contactName" as HouseholdSortField },
  { key: "contact", label: "admin.library.table.contact", sortField: "contactEmail" as HouseholdSortField },
  { key: "addressInput", label: "admin.library.table.address", sortField: "addressInput" as HouseholdSortField },
  { key: "placementNote", label: "admin.library.table.placementNote", sortField: null },
  { key: "accessNotes", label: "admin.library.table.accessNotes", sortField: null },
  { key: "createdAt", label: "admin.library.table.created", sortField: "createdAt" as HouseholdSortField },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function CopySubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.library.copying") : t("admin.library.copy")}
    </Button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? t("admin.library.deleting") : t("admin.library.delete")}
    </Button>
  );
}

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
  const [copyState, copyFormAction] = useFormState(copyToEvent, copyInitialState);
  const [deleteState, deleteFormAction] = useFormState(deleteHouseholdsAction, deleteInitialState);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());

  function toggleColumn(key: ColumnKey) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", alignSelf: "center" }}>
          {t("admin.library.columns.label")}
        </span>
        {COLUMNS.map((col) => (
          <label key={col.key} style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!hiddenColumns.has(col.key)}
              onChange={() => toggleColumn(col.key)}
            />
            {t(col.label)}
          </label>
        ))}
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-2)" }}>
        {t("admin.library.total", { count: total })}
      </p>

      <form action={deleteFormAction} id="library-bulk-form">
      <div className="admin-tableWrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>
                <input
                  type="checkbox"
                  aria-label={t("admin.bulk.selectAll")}
                  onChange={(e) => {
                    document
                      .querySelectorAll<HTMLInputElement>('input[name="householdIds"]')
                      .forEach((cb) => (cb.checked = e.target.checked));
                  }}
                />
              </th>
              <th style={thStyle}></th>
              {COLUMNS.filter((col) => !hiddenColumns.has(col.key)).map((col) => (
                <th key={col.key} style={thStyle}>
                  {col.sortField ? (
                    <a href={sortHref(col.sortField)} style={{ color: "inherit", textDecoration: "none" }}>
                      {t(col.label)} {sortBy === col.sortField ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </a>
                  ) : (
                    t(col.label)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {households.map((h) => (
              <tr key={h.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td style={tdStyle}>
                  <input type="checkbox" name="householdIds" value={h.id} />
                </td>
                <td style={tdStyle}>
                  <a href={`/admin/library/${h.id}`} style={{ color: "var(--color-accent-600)" }}>
                    {t("admin.household.edit")}
                  </a>
                </td>
                {!hiddenColumns.has("contactName") && <td style={tdStyle}>{h.contactName}</td>}
                {!hiddenColumns.has("contact") && (
                  <td style={tdStyle}>
                    {h.contactEmail}
                    {h.contactEmail && h.contactPhone ? " · " : ""}
                    {h.contactPhone}
                  </td>
                )}
                {!hiddenColumns.has("addressInput") && <td style={tdStyle}>{h.addressInput}</td>}
                {!hiddenColumns.has("placementNote") && <td style={tdStyle}>{h.placementNote}</td>}
                {!hiddenColumns.has("accessNotes") && <td style={tdStyle}>{h.accessNotes}</td>}
                {!hiddenColumns.has("createdAt") && (
                  <td style={tdStyle}>{new Date(h.createdAt).toLocaleDateString()}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          {page > 1 && <a href={pageHref(page - 1)}>{t("admin.library.pagination.prev")}</a>}
          <span style={{ color: "var(--text-muted)" }}>
            {t("admin.library.pagination.status", { page, totalPages })}
          </span>
          {page < totalPages && <a href={pageHref(page + 1)}>{t("admin.library.pagination.next")}</a>}
        </div>
      )}

      <div style={{ marginTop: "var(--space-3)" }}>
        <DeleteSubmitButton />
      </div>
      </form>

      <form
        action={copyFormAction}
        className="admin-formRow"
        style={{ marginTop: "var(--space-4)" }}
        onSubmit={(e) => {
          const form = e.currentTarget;
          form.querySelectorAll('input[name="householdIds"]').forEach((el) => el.remove());
          document
            .querySelectorAll<HTMLInputElement>('#library-bulk-form input[name="householdIds"]:checked')
            .forEach((cb) => {
              const hidden = document.createElement("input");
              hidden.type = "hidden";
              hidden.name = "householdIds";
              hidden.value = cb.value;
              form.appendChild(hidden);
            });
        }}
      >
        <label className="signup-field" style={{ marginBottom: 0 }}>
          <span className="signup-fieldLabel">{t("admin.library.eventLabel")}</span>
          <select className="signup-input" name="eventId" required defaultValue="">
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
        <CopySubmitButton />
      </form>

      {copyState.copied > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.library.success", { count: copyState.copied })}
        </p>
      )}
      {copyState.error && (
        <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
          {copyState.error}
        </p>
      )}
      {deleteState.deleted > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.library.deleteSuccess", { count: deleteState.deleted })}
        </p>
      )}
    </>
  );
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
