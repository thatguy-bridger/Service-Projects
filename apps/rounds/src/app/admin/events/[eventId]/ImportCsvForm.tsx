"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { importEventCsv } from "./actions";
import type { ImportResult } from "@service-projects/database";

const initialState: ImportResult = { imported: 0, errors: [] };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.eventDetail.import.submitting") : t("admin.eventDetail.import.submit")}
    </Button>
  );
}

export function ImportCsvForm({ eventId }: { eventId: string }) {
  const importWithEvent = importEventCsv.bind(null, eventId);
  const [state, formAction] = useFormState(importWithEvent, initialState);

  return (
    <form action={formAction} className="admin-formRow">
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.eventDetail.import.label")}</span>
        <input className="signup-input" type="file" name="file" accept=".csv,text/csv" required />
      </label>
      <SubmitButton />

      {state.imported > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", width: "100%" }}>
          {t("admin.eventDetail.import.success", { count: state.imported })}
        </p>
      )}
      {state.errors.length > 0 && (
        <div style={{ width: "100%" }}>
          <p className="signup-error" style={{ marginBottom: "var(--space-1)" }}>
            {t("admin.eventDetail.import.errorCount", { count: state.errors.length })}
          </p>
          <ul style={{ margin: 0, paddingLeft: "var(--space-5)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {state.errors.slice(0, 10).map((e, i) => (
              <li key={i}>
                {e.row > 0 ? t("admin.eventDetail.import.errorRow", { row: e.row }) + " " : ""}
                {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
