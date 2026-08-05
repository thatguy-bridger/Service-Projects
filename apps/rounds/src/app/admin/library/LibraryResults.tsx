"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { copyToEvent } from "./actions";
import type { CopyToEventResult } from "@service-projects/database";

const initialState: CopyToEventResult = { copied: 0 };

export interface LibraryHousehold {
  id: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressInput: string;
}

export interface EventOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.library.copying") : t("admin.library.copy")}
    </Button>
  );
}

export function LibraryResults({ households, events }: { households: LibraryHousehold[]; events: EventOption[] }) {
  const [state, formAction] = useFormState(copyToEvent, initialState);

  return (
    <form action={formAction}>
      <div className="admin-tableWrap">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>{t("admin.library.table.name")}</th>
              <th style={thStyle}>{t("admin.library.table.contact")}</th>
              <th style={thStyle}>{t("admin.library.table.address")}</th>
            </tr>
          </thead>
          <tbody>
            {households.map((h) => (
              <tr key={h.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td style={tdStyle}>
                  <input type="checkbox" name="householdIds" value={h.id} />
                </td>
                <td style={tdStyle}>{h.contactName}</td>
                <td style={tdStyle}>
                  {h.contactEmail}
                  {h.contactEmail && h.contactPhone ? " · " : ""}
                  {h.contactPhone}
                </td>
                <td style={tdStyle}>{h.addressInput}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-formRow" style={{ marginTop: "var(--space-4)" }}>
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
        <SubmitButton />
      </div>

      {state.copied > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.library.success", { count: state.copied })}
        </p>
      )}
      {state.error && (
        <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
          {state.error}
        </p>
      )}
    </form>
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
