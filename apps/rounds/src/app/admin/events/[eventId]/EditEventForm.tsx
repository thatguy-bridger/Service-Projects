"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { updateEventAction } from "./actions";
import type { UpdateEventResult, EventStatus } from "@service-projects/database";

const initialState: UpdateEventResult = { ok: false };
const STATUSES: EventStatus[] = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"];

function toLocalInputValue(date: Date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.eventDetail.edit.saving") : t("admin.eventDetail.edit.save")}
    </Button>
  );
}

export function EditEventForm({
  eventId,
  name,
  status,
  serviceStartsAt,
  serviceEndsAt,
}: {
  eventId: string;
  name: string;
  status: EventStatus;
  serviceStartsAt: Date;
  serviceEndsAt: Date;
}) {
  const withId = updateEventAction.bind(null, eventId);
  const [state, formAction] = useFormState(withId, initialState);

  return (
    <form action={formAction} className="admin-formRow">
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.eventDetail.edit.name")}</span>
        <input className="signup-input" name="name" defaultValue={name} required />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.eventDetail.edit.status")}</span>
        <select className="signup-input" name="status" defaultValue={status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.eventDetail.edit.starts")}</span>
        <input
          className="signup-input"
          type="datetime-local"
          name="serviceStartsAt"
          defaultValue={toLocalInputValue(serviceStartsAt)}
          required
        />
      </label>
      <label className="signup-field" style={{ marginBottom: 0 }}>
        <span className="signup-fieldLabel">{t("admin.eventDetail.edit.ends")}</span>
        <input
          className="signup-input"
          type="datetime-local"
          name="serviceEndsAt"
          defaultValue={toLocalInputValue(serviceEndsAt)}
          required
        />
      </label>
      <SaveButton />
      {state.ok && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", width: "100%", margin: 0 }}>
          {t("admin.eventDetail.edit.saved")}
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
