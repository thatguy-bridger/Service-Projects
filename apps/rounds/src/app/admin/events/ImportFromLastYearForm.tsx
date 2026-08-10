"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@service-projects/ui";
import { importCategoryFromPreviousYearAction } from "./actions";

export function ImportFromLastYearForm({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [sourceCategoryId, setSourceCategoryId] = useState(categories[0]?.id ?? "");
  const [yearOffset, setYearOffset] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) return null;

  async function handleImport() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const result = await importCategoryFromPreviousYearAction(sourceCategoryId, Number(yearOffset) || 0);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not import.");
      return;
    }
    setMessage(`Created ${result.created} event${result.created === 1 ? "" : "s"} as a new category, all drafts.`);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-end" }}>
      <label className="signup-field" style={{ marginBottom: 0, minWidth: 220 }}>
        <span className="signup-fieldLabel">Category to copy</span>
        <select className="signup-input" value={sourceCategoryId} onChange={(e) => setSourceCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="signup-field" style={{ marginBottom: 0, width: 120 }}>
        <span className="signup-fieldLabel">Years forward</span>
        <input
          className="signup-input"
          type="number"
          min={-10}
          max={10}
          value={yearOffset}
          onChange={(e) => setYearOffset(e.target.value)}
        />
      </label>
      <Button type="button" variant="secondary" disabled={submitting} onClick={handleImport}>
        {submitting ? "Importing…" : "Import as new category"}
      </Button>
      {error && <p className="signup-error" style={{ width: "100%" }}>{error}</p>}
      {message && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", width: "100%" }}>{message}</p>
      )}
    </div>
  );
}
