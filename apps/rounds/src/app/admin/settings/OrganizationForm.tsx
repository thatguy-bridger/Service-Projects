"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { updateOrganizationAction } from "./actions";
import type { UpdateOrganizationResult } from "@service-projects/database";

const initialState: UpdateOrganizationResult = { ok: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.settings.saving") : t("admin.settings.save")}
    </Button>
  );
}

export function OrganizationForm({ name, emailFrom }: { name: string; emailFrom: string }) {
  const [state, formAction] = useFormState(updateOrganizationAction, initialState);

  return (
    <form action={formAction} className="admin-formRow">
      <label className="signup-field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
        <span className="signup-fieldLabel">{t("admin.settings.orgName")}</span>
        <input className="signup-input" name="name" defaultValue={name} required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
        <span className="signup-fieldLabel">{t("admin.settings.emailFrom")}</span>
        <input
          className="signup-input"
          name="emailFrom"
          type="text"
          placeholder="Flag Program <flags@yourdomain.org>"
          defaultValue={emailFrom}
        />
        <span className="signup-hint" style={{ margin: 0 }}>
          {t("admin.settings.emailFromHint")}
        </span>
      </label>
      <SaveButton />
      {state.ok && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", width: "100%", margin: 0 }}>
          {t("admin.settings.saved")}
        </p>
      )}
      {state.error && (
        <p className="signup-error" style={{ width: "100%" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
