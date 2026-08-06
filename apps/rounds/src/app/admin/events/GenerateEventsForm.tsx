"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { generateFlagEvents, type ActionResult } from "./actions";

const initialState: ActionResult = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.events.generate.submitting") : t("admin.events.generate.submit")}
    </Button>
  );
}

export function GenerateEventsForm({ defaultOrgName, defaultYear }: { defaultOrgName: string; defaultYear: number }) {
  const [state, formAction] = useFormState(generateFlagEvents, initialState);

  return (
    <form action={formAction} className="admin-formRow">
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.generate.orgName")}</span>
        <input className="signup-input" type="text" name="orgName" defaultValue={defaultOrgName} required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.generate.year")}</span>
        <input className="signup-input" type="number" name="year" defaultValue={defaultYear} required style={{ width: 100 }} />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.generate.price")}</span>
        <input className="signup-input" type="number" name="priceDollars" defaultValue={12} min={0} step="0.01" required style={{ width: 100 }} />
      </label>
      <SubmitButton />
      {state.error && <p className="signup-error" style={{ width: "100%" }}>{state.error}</p>}
      {state.ok && <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", width: "100%" }}>{t("admin.events.generate.success")}</p>}
    </form>
  );
}
