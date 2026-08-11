"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@service-projects/ui";
import type { AddressPointSourceRow } from "@service-projects/database";
import { importAddressPointsAction, deleteAddressPointSourceAction } from "./actions";

export function AddressPointsClient({ initialSources }: { initialSources: AddressPointSourceRow[] }) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [source, setSource] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleImport() {
    setImporting(true);
    const result = await importAddressPointsAction(csvText, source);
    setMessage(
      result.ok
        ? `Imported ${result.imported} address point${result.imported === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped)` : ""}.`
        : (result.error ?? "Import failed.")
    );
    setImporting(false);
    if (result.ok) {
      setCsvText("");
      router.refresh();
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
          Import a CSV
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
          Paste an address-point CSV (OpenAddresses.io&apos;s LON/LAT/NUMBER/STREET/CITY/POSTCODE columns, or any
          file with LAT/LON and either an ADDRESS column or NUMBER+STREET). Give it a source label — re-importing
          the same label later replaces that batch, which is how a refresh works. Different labels (e.g. different
          counties) coexist.
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
            <span className="signup-fieldLabel">CSV text</span>
            <textarea
              className="signup-input"
              rows={10}
              style={{ fontFamily: "monospace", fontSize: "var(--text-sm)" }}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="LON,LAT,NUMBER,STREET,UNIT,CITY,DISTRICT,REGION,POSTCODE,ID,HASH&#10;-111.891,40.7608,350,State St,,Salt Lake City,,UT,84103,1,abc"
            />
          </label>
          <Button type="button" variant="primary" disabled={importing || !csvText.trim() || !source.trim()} onClick={handleImport}>
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
            Nothing imported yet — paste a CSV above to get started.
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
