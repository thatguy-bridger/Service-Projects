"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { addEventPerson, removeEventPerson, type MembershipActionResult } from "./actions";
import type { EventMembership } from "@service-projects/database";

const initialState: MembershipActionResult = {};
const ROLES = ["ADMIN", "COORDINATOR", "VOLUNTEER"] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.eventDetail.people.adding") : t("admin.eventDetail.people.add")}
    </Button>
  );
}

export function PeopleForm({ eventId, people }: { eventId: string; people: EventMembership[] }) {
  const addWithEvent = addEventPerson.bind(null, eventId);
  const [state, formAction] = useFormState(addWithEvent, initialState);

  return (
    <>
      <form action={formAction} className="admin-formRow">
        <label className="signup-field" style={{ marginBottom: 0 }}>
          <span className="signup-fieldLabel">{t("admin.eventDetail.people.email")}</span>
          <input className="signup-input" type="email" name="email" required />
        </label>
        <label className="signup-field" style={{ marginBottom: 0 }}>
          <span className="signup-fieldLabel">{t("admin.eventDetail.people.role")}</span>
          <select className="signup-input" name="role" defaultValue="VOLUNTEER">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton />
        {state.error && (
          <p className="signup-error" style={{ width: "100%" }}>
            {state.error}
          </p>
        )}
      </form>

      {people.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-3)" }}>
          {t("admin.eventDetail.people.empty")}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: "var(--space-3) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {people.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-sunken)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)" }}>
                {p.user.name ?? p.user.email}
                {p.user.name && <span style={{ color: "var(--text-muted)" }}> · {p.user.email}</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Badge tone="accent">{p.role}</Badge>
                <form action={removeEventPerson.bind(null, eventId, p.id)}>
                  <Button type="submit" variant="ghost">
                    {t("admin.eventDetail.people.remove")}
                  </Button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
