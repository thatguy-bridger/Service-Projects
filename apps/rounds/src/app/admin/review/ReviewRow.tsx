"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { markReviewedAction, type MarkReviewedActionResult } from "./actions";

const initialState: MarkReviewedActionResult = { ok: false };

function MarkButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.review.marking") : t("admin.review.markReviewed")}
    </Button>
  );
}

export interface ReviewHousehold {
  id: string;
  contactName: string;
  addressInput: string;
  needsReviewReason: string | null;
  createdAt: Date;
}

export function ReviewRow({ household }: { household: ReviewHousehold }) {
  const withId = markReviewedAction.bind(null, household.id);
  const [state, formAction] = useFormState(withId, initialState);

  if (state.ok) return null; // Optimistic: revalidatePath will confirm on next navigation too.

  return (
    <tr style={{ borderTop: "1px solid var(--border-default)" }}>
      <td style={tdStyle}>
        <a href={`/admin/library/${household.id}`} style={{ color: "var(--color-accent-600)", fontWeight: "var(--weight-medium)" as unknown as number }}>
          {household.contactName}
        </a>
      </td>
      <td style={tdStyle}>{household.addressInput}</td>
      <td style={tdStyle}>
        <Badge tone="warning">{household.needsReviewReason ?? t("admin.review.noReason")}</Badge>
      </td>
      <td style={tdStyle}>{household.createdAt.toLocaleDateString()}</td>
      <td style={tdStyle}>
        <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <a href={`/admin/library/${household.id}`}>
            <Button type="button" variant="ghost">
              {t("admin.household.edit")}
            </Button>
          </a>
          <MarkButton />
          {state.error && <span className="signup-error" style={{ fontSize: "var(--text-xs)" }}>{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-sm)",
};
