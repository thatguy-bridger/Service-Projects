"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { createCustomEvent, type ActionResult } from "./actions";

const initialState: ActionResult = {};
const KINDS = ["FLAG_SETOUT", "FLAG_PICKUP", "FLYER_DELIVERY", "FUNDRAISER", "PICKUP_COLLECTION"] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.events.custom.submitting") : t("admin.events.custom.submit")}
    </Button>
  );
}

export function CreateEventForm({ defaultOrgName }: { defaultOrgName: string }) {
  const [state, formAction] = useFormState(createCustomEvent, initialState);

  return (
    <form action={formAction} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
      <input type="hidden" name="orgName" value={defaultOrgName} />
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.custom.name")}</span>
        <input className="signup-input" type="text" name="name" required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.custom.kind")}</span>
        <select className="signup-input" name="kind" required defaultValue="FUNDRAISER">
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.custom.start")}</span>
        <input className="signup-input" type="datetime-local" name="serviceStartsAt" required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.events.custom.end")}</span>
        <input className="signup-input" type="datetime-local" name="serviceEndsAt" required />
      </label>
      <SubmitButton />
      {state.error && <p className="signup-error" style={{ width: "100%" }}>{state.error}</p>}
      {state.ok && <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", width: "100%" }}>{t("admin.events.custom.success")}</p>}
    </form>
  );
}
