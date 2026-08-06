"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@service-projects/ui";
import { createEventsAction, type BulkEventInput } from "./actions";
import { EVENT_KINDS, EVENT_KIND_LABELS } from "@/lib/eventKinds";
import { FLAG_HOLIDAYS } from "@/lib/holidays";

const NEW_CATEGORY_VALUE = "__new__";
const UNCATEGORIZED_VALUE = "";

function blankRow(): BulkEventInput {
  return { name: "", kind: "FLAG_SETOUT", serviceStartsAt: "", priceDollars: "" };
}

export function CreateEventsForm({
  defaultOrgName,
  categories,
  defaultYear,
}: {
  defaultOrgName: string;
  categories: { id: string; name: string }[];
  defaultYear: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BulkEventInput[]>([blankRow()]);
  const [categoryChoice, setCategoryChoice] = useState<string>(UNCATEGORIZED_VALUE);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateRow(index: number, patch: Partial<BulkEventInput>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // Convenience, not a special code path: prefills the 7 standard flag
  // holidays as ordinary rows in a brand-new category for that year --
  // an admin can still edit, remove, or add to them before submitting.
  function prefillFlagHolidays() {
    setRows(
      FLAG_HOLIDAYS.map((h) => ({
        name: `${h.name} ${defaultYear} — Flag Set-Out`,
        kind: "FLAG_SETOUT",
        serviceStartsAt: h.dateFor(defaultYear).toISOString().slice(0, 10),
        priceDollars: "12",
      }))
    );
    setCategoryChoice(NEW_CATEGORY_VALUE);
    setNewCategoryName(`${defaultYear} Flag Events`);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const result = await createEventsAction({
      orgName: defaultOrgName,
      categoryId: categoryChoice === NEW_CATEGORY_VALUE || categoryChoice === UNCATEGORIZED_VALUE ? null : categoryChoice,
      newCategoryName: categoryChoice === NEW_CATEGORY_VALUE ? newCategoryName : "",
      events: rows,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create events.");
      return;
    }
    setSuccess(true);
    setRows([blankRow()]);
    setCategoryChoice(UNCATEGORIZED_VALUE);
    setNewCategoryName("");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-3)" }}>
        <label className="signup-field" style={{ marginBottom: 0, minWidth: 220 }}>
          <span className="signup-fieldLabel">Category</span>
          <select className="signup-input" value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value)}>
            <option value={UNCATEGORIZED_VALUE}>(Uncategorized)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY_VALUE}>+ New category…</option>
          </select>
        </label>
        {categoryChoice === NEW_CATEGORY_VALUE && (
          <label className="signup-field" style={{ marginBottom: 0, minWidth: 220 }}>
            <span className="signup-fieldLabel">New category name</span>
            <input
              className="signup-input"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
          </label>
        )}
        <Button type="button" variant="secondary" onClick={prefillFlagHolidays}>
          Prefill 7 flag holidays
        </Button>
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        {rows.map((row, index) => (
          <div
            key={index}
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "flex-end" }}
          >
            <label className="signup-field" style={{ marginBottom: 0, flex: "2 1 200px" }}>
              <span className="signup-fieldLabel">Name</span>
              <input
                className="signup-input"
                type="text"
                value={row.name}
                onChange={(e) => updateRow(index, { name: e.target.value })}
              />
            </label>
            <label className="signup-field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
              <span className="signup-fieldLabel">Kind</span>
              <select className="signup-input" value={row.kind} onChange={(e) => updateRow(index, { kind: e.target.value })}>
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EVENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="signup-field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
              <span className="signup-fieldLabel">Date</span>
              <input
                className="signup-input"
                type="date"
                value={row.serviceStartsAt}
                onChange={(e) => updateRow(index, { serviceStartsAt: e.target.value })}
              />
            </label>
            <label className="signup-field" style={{ marginBottom: 0, flex: "1 1 100px" }}>
              <span className="signup-fieldLabel">Price ($)</span>
              <input
                className="signup-input"
                type="number"
                min={0}
                step="0.01"
                value={row.priceDollars}
                onChange={(e) => updateRow(index, { priceDollars: e.target.value })}
              />
            </label>
            <Button type="button" variant="secondary" disabled={rows.length === 1} onClick={() => removeRow(index)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <Button type="button" variant="secondary" onClick={addRow}>
          + Add another event
        </Button>
        <Button type="button" variant="primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Creating…" : `Create ${rows.length} event${rows.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      {error && <p className="signup-error">{error}</p>}
      {success && <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)" }}>Created.</p>}
    </div>
  );
}
