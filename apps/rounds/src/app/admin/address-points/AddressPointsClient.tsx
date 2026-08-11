"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@service-projects/ui";
import type { AddressPointSourceRow } from "@service-projects/database";
import { parseAddressPoints } from "@service-projects/database/addressPointParsing";
import { importAddressPointBatchAction, deleteAddressPointSourceAction } from "./actions";

// Rows per upload request -- small enough that even a worst-case
// address (long street name, unit, city) stays a tiny fraction of
// Vercel's serverless body-size cap, so this never needs to know where
// that cap actually is.
const UPLOAD_BATCH_SIZE = 2000;

export function AddressPointsClient({ initialSources }: { initialSources: AddressPointSourceRow[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The file's actual contents never go into React state or the DOM --
  // a 12MB+ string as a controlled <textarea> value re-renders the
  // whole thing into the page on every keystroke/paste, which is what
  // was actually slow (not the import itself). Read once on submit,
  // held in a plain ref, shown only as a filename + size.
  const fileTextRef = useRef<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      fileTextRef.current = null;
      setFileLabel(null);
      return;
    }
    fileTextRef.current = await file.text();
    setFileLabel(`${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
  }

  async function handleImport() {
    if (!fileTextRef.current) return;
    setImporting(true);
    setMessage(null);

    // Parsed once in the browser, then uploaded a few thousand rows at
    // a time -- each request stays tiny regardless of the source
    // file's size, which is what actually makes a real progress bar
    // possible (batches completed / total) instead of one opaque
    // all-or-nothing request.
    const { rows, skipped } = parseAddressPoints(fileTextRef.current);
    if (rows.length === 0) {
      setMessage(skipped > 0 ? "No valid rows to import — check the lat/lng data." : "No rows found in that file.");
      setImporting(false);
      return;
    }

    const batches: (typeof rows)[] = [];
    for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
      batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
    }
    setProgress({ done: 0, total: batches.length });

    let imported = 0;
    for (let i = 0; i < batches.length; i++) {
      const result = await importAddressPointBatchAction(batches[i], source, i === 0);
      if (!result.ok) {
        setMessage(result.error ?? "Import failed partway through.");
        setImporting(false);
        setProgress(null);
        router.refresh();
        return;
      }
      imported += result.imported;
      setProgress({ done: i + 1, total: batches.length });
    }

    setMessage(
      `Imported ${imported} address point${imported === 1 ? "" : "s"}${skipped ? ` (${skipped} row${skipped === 1 ? "" : "s"} skipped)` : ""}.`
    );
    setImporting(false);
    setProgress(null);
    fileTextRef.current = null;
    setFileLabel(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
          Import a file
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
          Pick a file with address-point data in either format OpenAddresses.io publishes: newline-delimited GeoJSON
          (one <code>{`{"type":"Feature",...}`}</code> object per line — their real default export) or CSV
          (LON/LAT/NUMBER/STREET/CITY/POSTCODE columns, or any file with LAT/LON and either an ADDRESS column or
          NUMBER+STREET). Detected automatically. Give it a source label — re-importing the same label later
          replaces that batch, which is how a refresh works. Different labels (e.g. different counties) coexist.
        </p>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">Source label</span>
            <input
              className="signup-input"
              type="text"
              placeholder="Salt Lake County 2027-Q1"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </label>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">File</span>
            <input
              ref={fileInputRef}
              className="signup-input"
              type="file"
              accept=".json,.geojson,.ndjson,.csv,.txt"
              onChange={handleFileChange}
            />
          </label>
          {fileLabel && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>{fileLabel}</p>
          )}
          <Button type="button" variant="primary" disabled={importing || !fileLabel || !source.trim()} onClick={handleImport}>
            {importing
              ? progress
                ? `Importing… (${progress.done}/${progress.total})`
                : "Parsing…"
              : "Import"}
          </Button>
          {importing && progress && (
            <div
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "999px",
                background: "var(--surface-muted, #e5e7eb)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  height: "100%",
                  background: "var(--accent, #2563eb)",
                  transition: "width 150ms ease",
                }}
              />
            </div>
          )}
          {/* The button needs a source label AND a chosen file, both --
              easy to fill in one and wonder why it's still grayed out,
              so say exactly what's still missing instead of leaving it
              to be inferred. */}
          {!importing && (!fileLabel || !source.trim()) && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
              {!fileLabel && !source.trim()
                ? "Enter a source label and choose a file to enable Import."
                : !fileLabel
                  ? "Choose a file to enable Import."
                  : "Enter a source label to enable Import."}
            </p>
          )}
          {message && <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>{message}</p>}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
          Imported sources
        </h2>
        {initialSources.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Nothing imported yet — pick a file above to get started.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {initialSources.map((s) => (
              <Card key={s.source} style={{ padding: "var(--space-4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <div>
                    <strong>{s.source}</strong>
                    <p style={{ margin: "2px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      {s.count.toLocaleString()} address point{s.count === 1 ? "" : "s"} · imported{" "}
                      {new Date(s.importedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm(`Delete all ${s.count.toLocaleString()} address points from "${s.source}"?`)) return;
                      await deleteAddressPointSourceAction(s.source);
                      router.refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
