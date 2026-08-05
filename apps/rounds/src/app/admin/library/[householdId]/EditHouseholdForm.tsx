"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { updateHouseholdAction } from "./actions";
import type { UpdateHouseholdResult } from "@service-projects/database";

const initialState: UpdateHouseholdResult = { ok: false };

export interface HouseholdDetail {
  id: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  addressInput: string;
  placementNote: string | null;
  accessNotes: string | null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.household.saving") : t("admin.household.save")}
    </Button>
  );
}

export function EditHouseholdForm({ household }: { household: HouseholdDetail }) {
  const withId = updateHouseholdAction.bind(null, household.id);
  const [state, formAction] = useFormState(withId, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.household.name")}</span>
        <input className="signup-input" name="contactName" defaultValue={household.contactName} required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.household.email")}</span>
        <input className="signup-input" type="email" name="contactEmail" defaultValue={household.contactEmail ?? ""} />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.household.phone")}</span>
        <input className="signup-input" name="contactPhone" defaultValue={household.contactPhone ?? ""} />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.household.address")}</span>
        <input className="signup-input" name="addressInput" defaultValue={household.addressInput} required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.household.placementNote")}</span>
        <input className="signup-input" name="placementNote" defaultValue={household.placementNote ?? ""} />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.household.accessNotes")}</span>
        <input className="signup-input" name="accessNotes" defaultValue={household.accessNotes ?? ""} />
      </label>

      <div>
        <SaveButton />
      </div>

      {state.ok && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", margin: 0 }}>
          {t("admin.household.saved")}
        </p>
      )}
      {state.error && (
        <p className="signup-error" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
