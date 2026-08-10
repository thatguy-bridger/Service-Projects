"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@service-projects/ui";
import { createEventsAction, type BulkEventInput } from "./actions";
import { EVENT_KINDS, EVENT_KIND_LABELS } from "@/lib/eventKinds";
import { FLAG_HOLIDAYS } from "@/lib/holidays";
import { EventCalendar } from "./EventCalendar";
import { generateRecurringDates, FREQUENCY_LABELS, type Frequency } from "@/lib/recurrence";

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

  // Shared by both the recurrence generator and calendar clicks -- one
  // "what am I adding" template instead of asking twice.
  const [template, setTemplate] = useState({ name: "", kind: "FLAG_SETOUT", priceDollars: "" });
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [recurStart, setRecurStart] = useState("");
  const [occurrences, setOccurrences] = useState("4");

  const selectedDates = useMemo(() => new Set(rows.map((r) => r.serviceStartsAt).filter(Boolean)), [rows]);

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

  // Appends -- doesn't touch rows already there, so this composes with
  // prefill/manual rows/calendar clicks instead of overwriting them.
  function generateRecurring() {
    const dates = generateRecurringDates(recurStart, frequency, Number(occurrences) || 0);
    if (dates.length === 0) return;
    const name = template.name.trim() || "Event";
    setRows((prev) => [
      ...prev,
      ...dates.map((date) => ({ name, kind: template.kind, serviceStartsAt: date, priceDollars: template.priceDollars })),
    ]);
  }

  // Calendar click: remove this date's row(s) if it's already selected
  // (a plain, un-annoying way to undo a click), otherwise add one row
  // for that date using the current template.
  function handleToggleDate(dateKey: string) {
    setRows((prev) => {
      const hasDate = prev.some((r) => r.serviceStartsAt === dateKey);
      if (hasDate) return prev.filter((r) => r.serviceStartsAt !== dateKey);
      const name = template.name.trim() || "Event";
      const templated = { name, kind: template.kind, serviceStartsAt: dateKey, priceDollars: template.priceDollars };
      // Replace a single leftover blank row instead of piling up empties.
      if (prev.length === 1 && !prev[0].name && !prev[0].serviceStartsAt) return [templated];
      return [...prev, templated];
    });
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
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
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

      <div className="card" style={{ display: "grid", gap: "var(--space-3)" }}>
        <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)" }}>
          Event template
        </h3>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          Used by both the recurrence generator below and clicking dates on the calendar — each event still gets
          its own editable row, so rename or reprice any of them afterward.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <label className="signup-field" style={{ marginBottom: 0, flex: "2 1 200px" }}>
            <span className="signup-fieldLabel">Name</span>
            <input
              className="signup-input"
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            />
          </label>
          <label className="signup-field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
            <span className="signup-fieldLabel">Kind</span>
            <select
              className="signup-input"
              value={template.kind}
              onChange={(e) => setTemplate({ ...template, kind: e.target.value })}
            >
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="signup-field" style={{ marginBottom: 0, flex: "1 1 100px" }}>
            <span className="signup-fieldLabel">Price ($)</span>
            <input
              className="signup-input"
              type="number"
              min={0}
              step="0.01"
              value={template.priceDollars}
              onChange={(e) => setTemplate({ ...template, priceDollars: e.target.value })}
            />
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-end" }}>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">Repeats</span>
            <select className="signup-input" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">Starting</span>
            <input className="signup-input" type="date" value={recurStart} onChange={(e) => setRecurStart(e.target.value)} />
          </label>
          <label className="signup-field" style={{ marginBottom: 0, width: 100 }}>
            <span className="signup-fieldLabel"># of events</span>
            <input
              className="signup-input"
              type="number"
              min={1}
              max={104}
              value={occurrences}
              onChange={(e) => setOccurrences(e.target.value)}
            />
          </label>
          <Button type="button" variant="secondary" onClick={generateRecurring} disabled={!recurStart}>
            Generate recurring events
          </Button>
        </div>

        <div>
          <span className="signup-fieldLabel" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            Or click dates on the calendar to add/remove events (using the template above)
          </span>
          <EventCalendar selectedDates={selectedDates} onToggleDate={handleToggleDate} />
        </div>
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
