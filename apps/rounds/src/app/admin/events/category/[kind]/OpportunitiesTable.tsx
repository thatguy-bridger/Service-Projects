"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { formatHolidayDate } from "@/lib/format";
import { deleteEventsAction, type DeleteEventsActionResult } from "./actions";

const initialState: DeleteEventsActionResult = { deleted: 0 };

export interface OpportunityRow {
  id: string;
  name: string;
  serviceStartsAt: Date;
  status: string;
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? t("admin.events.bulk.deleting") : t("admin.events.bulk.delete")}
    </Button>
  );
}

export function OpportunitiesTable({ opportunities }: { opportunities: OpportunityRow[] }) {
  const [state, formAction] = useFormState(deleteEventsAction, initialState);

  return (
    <form action={formAction}>
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
                      .querySelectorAll<HTMLInputElement>('input[name="eventIds"]')
                      .forEach((cb) => (cb.checked = e.target.checked));
                  }}
                />
              </th>
              <th style={thStyle}>{t("admin.events.list.name")}</th>
              <th style={thStyle}>{t("admin.events.list.date")}</th>
              <th style={thStyle}>{t("admin.events.list.status")}</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((ev) => (
              <tr key={ev.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td style={tdStyle}>
                  <input type="checkbox" name="eventIds" value={ev.id} />
                </td>
                <td style={tdStyle}>
                  <a
                    href={`/admin/events/${ev.id}`}
                    style={{ color: "var(--color-accent-600)", fontWeight: "var(--weight-medium)" as unknown as number }}
                  >
                    {ev.name}
                  </a>
                </td>
                <td style={tdStyle}>{formatHolidayDate(ev.serviceStartsAt)}</td>
                <td style={tdStyle}>
                  <Badge tone="success">{ev.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        <DeleteButton />
      </div>

      {state.deleted > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.events.bulk.success", { count: state.deleted })}
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
