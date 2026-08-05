"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { updateSeasonAction } from "./actions";
import type { UpdateSeasonResult } from "@service-projects/database";

const initialState: UpdateSeasonResult = { ok: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.settings.saving") : t("admin.settings.save")}
    </Button>
  );
}

export interface SeasonRowData {
  id: string;
  year: number;
  name: string;
  priceCents: number;
  pricingMode: string;
}

export function SeasonRow({ season }: { season: SeasonRowData }) {
  const withId = updateSeasonAction.bind(null, season.id);
  const [state, formAction] = useFormState(withId, initialState);

  return (
    <tr style={{ borderTop: "1px solid var(--border-default)" }}>
      <td style={tdStyle}>{season.year}</td>
      <td style={tdStyle}>
        <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <input className="signup-input" name="name" defaultValue={season.name} style={{ minWidth: 140 }} />
          <input
            className="signup-input"
            name="priceDollars"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(season.priceCents / 100).toFixed(2)}
            style={{ width: 90 }}
          />
          <SaveButton />
          {state.ok && <span style={{ color: "var(--color-success-500)", fontSize: "var(--text-xs)" }}>{t("admin.settings.saved")}</span>}
          {state.error && <span className="signup-error" style={{ fontSize: "var(--text-xs)" }}>{state.error}</span>}
        </form>
      </td>
      <td style={tdStyle}>{season.pricingMode}</td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-sm)",
};
