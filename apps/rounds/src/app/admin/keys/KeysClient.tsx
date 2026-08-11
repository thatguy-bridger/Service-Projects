"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { DataTable, type DataTableColumn, Button } from "@service-projects/ui";
import { createInviteKeyAction, revokeInviteKeysAction } from "./actions";
import type { Role } from "@prisma/client";

export interface KeyRow {
  id: string;
  codePrefix: string;
  grantsRole: Role;
  eventId: string | null;
  eventName: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  note: string | null;
  revoked: boolean;
}

const ROLE_OPTIONS: Role[] = ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER", "PREVIEWER"];

const KEY_COLUMNS: DataTableColumn<KeyRow>[] = [
  { key: "codePrefix", label: "Code prefix", getValue: (r) => r.codePrefix },
  { key: "grantsRole", label: "Grants role", getValue: (r) => r.grantsRole },
  { key: "eventName", label: "Event", getValue: (r) => r.eventName ?? "(org-wide)" },
  { key: "useCount", label: "Uses", getValue: (r) => `${r.useCount} / ${r.maxUses}` },
  { key: "expiresAt", label: "Expires", getValue: (r) => r.expiresAt ?? "—" },
  { key: "note", label: "Note", getValue: (r) => r.note ?? "" },
  { key: "revoked", label: "Revoked", getValue: (r) => (r.revoked ? "yes" : "no") },
];

export function KeysClient({
  initialRows,
  events,
}: {
  initialRows: KeyRow[];
  events: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({
    grantsRole: "VOLUNTEER" as Role,
    eventId: "",
    maxUses: "1",
    expiresAt: "",
    note: "",
  });
  const [revealed, setRevealed] = useState<{ rawCode: string; qrDataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redeemUrl = revealed ? `${typeof window !== "undefined" ? window.location.origin : ""}/redeem/${revealed.rawCode}` : "";

  async function handleIssue() {
    setIssuing(true);
    setError(null);
    const result = await createInviteKeyAction({
      grantsRole: form.grantsRole,
      eventId: form.eventId || null,
      maxUses: Number(form.maxUses) || 1,
      expiresAt: form.expiresAt || null,
      note: form.note || null,
    });
    setIssuing(false);
    if (!result.ok || !result.rawCode) {
      setError(result.error ?? "Could not issue key.");
      return;
    }
    const url = `${window.location.origin}/redeem/${result.rawCode}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    setRevealed({ rawCode: result.rawCode, qrDataUrl });
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div className="card" style={{ display: "grid", gap: "var(--space-3)", maxWidth: 480 }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Issue a new key</h2>
        <label className="signup-field">
          <span className="signup-fieldLabel">Grants role</span>
          <select
            className="signup-input"
            value={form.grantsRole}
            onChange={(e) => setForm({ ...form, grantsRole: e.target.value as Role })}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="signup-field">
          <span className="signup-fieldLabel">Event (leave blank for org-wide)</span>
          <select className="signup-input" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}>
            <option value="">(org-wide)</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </label>
        <label className="signup-field">
          <span className="signup-fieldLabel">Max uses</span>
          <input
            className="signup-input"
            type="number"
            min={1}
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
          />
        </label>
        <label className="signup-field">
          <span className="signup-fieldLabel">Expires (optional)</span>
          <input
            className="signup-input"
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
        </label>
        <label className="signup-field">
          <span className="signup-fieldLabel">Note (optional)</span>
          <input
            className="signup-input"
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        {error && <p style={{ color: "var(--color-danger-600, crimson)", margin: 0 }}>{error}</p>}
        <Button onClick={handleIssue} disabled={issuing}>
          {issuing ? "Issuing…" : "Issue key"}
        </Button>
      </div>

      {revealed && (
        <div id="key-share-sheet" className="card" style={{ display: "grid", gap: "var(--space-3)", maxWidth: 480 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)" }}>Share this key</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            This code is shown once and is never stored raw — save or share it now.
          </p>
          {/* SPEC.md §3.3: "the code in 32px type" -- the QR code and
              link below cover the tap-to-redeem case, but the raw code
              itself was previously only ever embedded (unreadably
              small) inside the URL text box -- no way to read it aloud
              over the phone or copy it by hand. */}
          <p
            style={{
              margin: 0,
              fontFamily: "monospace",
              fontSize: "32px",
              fontWeight: "var(--weight-semibold)",
              letterSpacing: "0.05em",
              wordBreak: "break-all",
              textAlign: "center",
            }}
          >
            {revealed.rawCode}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image can't optimize it */}
          <img src={revealed.qrDataUrl} alt="QR code for redemption link" width={240} height={240} style={{ justifySelf: "center" }} />
          <input
            readOnly
            aria-label="Redemption link"
            value={redeemUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          {/* SPEC.md §3.3: "a printable slip." print.css scopes down to
              just this card (see globals.css's #key-share-sheet rules)
              so the rest of the admin chrome doesn't end up on paper. */}
          <div className="no-print" style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="secondary" onClick={() => window.print()}>
              Print slip
            </Button>
            <Button variant="secondary" onClick={() => setRevealed(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <DataTable<KeyRow>
        rows={initialRows}
        columns={KEY_COLUMNS}
        csvFilenamePrefix="invite-keys"
        emptyMessage="No keys issued yet — use the form above."
        deleteLabel="Revoke selected keys"
        onDeleteSelected={(ids) => revokeInviteKeysAction(ids)}
      />
    </div>
  );
}
