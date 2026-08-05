"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { addEventPerson, removeEventPeopleBulk, type MembershipActionResult, type RemovePeopleResult } from "./actions";
import type { EventMembership } from "@service-projects/database";

const addInitialState: MembershipActionResult = {};
const removeInitialState: RemovePeopleResult = { removed: 0 };
const ROLES = ["ADMIN", "COORDINATOR", "VOLUNTEER"] as const;

function AddSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.eventDetail.people.adding") : t("admin.eventDetail.people.add")}
    </Button>
  );
}

function RemoveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? t("admin.eventDetail.people.removing") : t("admin.eventDetail.people.removeSelected")}
    </Button>
  );
}

export function PeopleForm({ eventId, people }: { eventId: string; people: EventMembership[] }) {
  const addWithEvent = addEventPerson.bind(null, eventId);
  const [addState, addFormAction] = useFormState(addWithEvent, addInitialState);

  const removeWithEvent = removeEventPeopleBulk.bind(null, eventId);
  const [removeState, removeFormAction] = useFormState(removeWithEvent, removeInitialState);

  return (
    <>
      <form action={addFormAction} className="admin-formRow">
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
        <AddSubmitButton />
        {addState.error && (
          <p className="signup-error" style={{ width: "100%" }}>
            {addState.error}
          </p>
        )}
      </form>

      {people.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-3)" }}>
          {t("admin.eventDetail.people.empty")}
        </p>
      ) : (
        <form action={removeFormAction} style={{ marginTop: "var(--space-3)" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {people.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface-sunken)",
                }}
              >
                <input type="checkbox" name="membershipIds" value={p.id} />
                <span style={{ fontSize: "var(--text-sm)", flex: 1 }}>
                  {p.user.name ?? p.user.email}
                  {p.user.name && <span style={{ color: "var(--text-muted)" }}> · {p.user.email}</span>}
                </span>
                <Badge tone="accent">{p.role}</Badge>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "var(--space-3)" }}>
            <RemoveSubmitButton />
          </div>
          {removeState.removed > 0 && (
            <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
              {t("admin.eventDetail.people.removeSuccess", { count: removeState.removed })}
            </p>
          )}
          {removeState.error && (
            <p className="signup-error" style={{ marginTop: "var(--space-2)" }}>
              {removeState.error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
