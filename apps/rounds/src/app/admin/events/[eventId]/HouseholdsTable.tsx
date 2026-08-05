"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { removeHouseholdsAction, copyHouseholdsToOtherEventAction } from "./actions";
import type { HouseholdForEvent, DeleteResult, CopyToEventResult } from "@service-projects/database";

const removeInitialState: DeleteResult = { deleted: 0, errors: [] };
const copyInitialState: CopyToEventResult = { copied: 0 };

export interface OtherEventOption {
  id: string;
  name: string;
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? t("admin.eventDetail.households.removing") : t("admin.eventDetail.households.remove")}
    </Button>
  );
}

function CopyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.eventDetail.households.copying") : t("admin.eventDetail.households.copy")}
    </Button>
  );
}

export function HouseholdsTable({
  eventId,
  rows,
  otherEvents,
}: {
  eventId: string;
  rows: HouseholdForEvent[];
  otherEvents: OtherEventOption[];
}) {
  const removeWithEvent = removeHouseholdsAction.bind(null, eventId);
  const [removeState, removeFormAction] = useFormState(removeWithEvent, removeInitialState);

  const copyWithEvent = copyHouseholdsToOtherEventAction.bind(null, eventId);
  const [copyState, copyFormAction] = useFormState(copyWithEvent, copyInitialState);

  return (
    <>
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
                      .querySelectorAll<HTMLInputElement>('input[name="subscriptionEventIds"]')
                      .forEach((cb) => (cb.checked = e.target.checked));
                  }}
                />
              </th>
              <th style={thStyle}>{t("admin.eventDetail.list.name")}</th>
              <th style={thStyle}>{t("admin.eventDetail.list.contact")}</th>
              <th style={thStyle}>{t("admin.eventDetail.list.address")}</th>
              <th style={thStyle}>{t("admin.eventDetail.list.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.subscriptionEventId} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td style={tdStyle}>
                  <input
                    type="checkbox"
                    name="subscriptionEventIds"
                    value={row.subscriptionEventId}
                    data-household-id={row.household.id}
                  />
                </td>
                <td style={tdStyle}>{row.household.contactName}</td>
                <td style={tdStyle}>
                  {row.household.contactEmail}
                  {row.household.contactEmail && row.household.contactPhone ? " · " : ""}
                  {row.household.contactPhone}
                </td>
                <td style={tdStyle}>{row.household.addressInput}</td>
                <td style={tdStyle}>
                  <Badge tone={row.skipped ? "neutral" : "accent"}>
                    {row.skipped ? t("admin.eventDetail.list.skipped") : row.subscriptionStatus}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
        <form action={removeFormAction}>
          <RemoveButton />
        </form>

        {otherEvents.length > 0 && (
          <form
            action={copyFormAction}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
            onSubmit={(e) => {
              const form = e.currentTarget;
              form.querySelectorAll('input[name="householdIds"]').forEach((el) => el.remove());
              document
                .querySelectorAll<HTMLInputElement>('input[name="subscriptionEventIds"]:checked')
                .forEach((cb) => {
                  const hidden = document.createElement("input");
                  hidden.type = "hidden";
                  hidden.name = "householdIds";
                  hidden.value = cb.dataset.householdId ?? "";
                  form.appendChild(hidden);
                });
            }}
          >
            <select className="signup-input" name="targetEventId" defaultValue="" required>
              <option value="" disabled>
                {t("admin.eventDetail.households.copyTarget")}
              </option>
              {otherEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <CopyButton />
          </form>
        )}
      </div>

      {removeState.deleted > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.eventDetail.households.removeSuccess", { count: removeState.deleted })}
        </p>
      )}
      {removeState.errors.length > 0 && removeState.errors.some((e) => e.reason) && (
        <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
          {removeState.errors[0].reason}
        </p>
      )}

      {copyState.copied > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.eventDetail.households.copySuccess", { count: copyState.copied })}
        </p>
      )}
      {copyState.error && (
        <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
          {copyState.error}
        </p>
      )}
    </>
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
