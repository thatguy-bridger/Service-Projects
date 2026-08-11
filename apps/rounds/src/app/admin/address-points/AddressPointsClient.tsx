"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@service-projects/ui";
import type { AddressPointSourceRow } from "@service-projects/database";
import { importAddressPointsAction, deleteAddressPointSourceAction } from "./actions";

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
    const result = await importAddressPointsAction(fileTextRef.current, source);
    setMessage(
      result.ok
        ? `Imported ${result.imported} address point${result.imported === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped)` : ""}.`
        : (result.error ?? "Import failed.")
    );
    setImporting(false);
    if (result.ok) {
      fileTextRef.current = null;
      setFileLabel(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
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
            {importing ? "Importing…" : "Import"}
          </Button>
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
