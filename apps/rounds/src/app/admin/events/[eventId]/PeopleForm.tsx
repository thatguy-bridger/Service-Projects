"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import {
  addEventPerson,
  removeEventPeopleBulk,
  updateEventPersonRoleAction,
  type MembershipActionResult,
  type RemovePeopleResult,
  type UpdatePersonRoleResult,
} from "./actions";
import type { EventMembership } from "@service-projects/database";

const addInitialState: MembershipActionResult = {};
const removeInitialState: RemovePeopleResult = { removed: 0 };
const roleInitialState: UpdatePersonRoleResult = { ok: false };
const ROLES = ["ADMIN", "COORDINATOR", "VOLUNTEER"] as const;

function RoleSaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.eventDetail.people.savingRole") : t("admin.eventDetail.people.saveRole")}
    </Button>
  );
}

function PersonRoleEditor({ eventId, membershipId, role }: { eventId: string; membershipId: string; role: string }) {
  const withIds = updateEventPersonRoleAction.bind(null, eventId, membershipId);
  const [state, formAction] = useFormState(withIds, roleInitialState);

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <select className="signup-input" name="role" defaultValue={role} style={{ minWidth: 130 }}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <RoleSaveButton />
      {state.ok && <span style={{ color: "var(--color-success-500)", fontSize: "var(--text-xs)" }}>{t("admin.eventDetail.people.roleSaved")}</span>}
      {state.error && <span className="signup-error" style={{ fontSize: "var(--text-xs)" }}>{state.error}</span>}
    </form>
  );
}

function AddSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? t("admin.eventDetail.people.adding") : t("admin.eventDetail.people.add")}
    </Button>
  );
}

function RemoveSubmitButton({ form }: { form: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" form={form} variant="danger" disabled={pending}>
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
        <div style={{ marginTop: "var(--space-3)" }}>
          <form action={removeFormAction} id="people-remove-form" />
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
                  flexWrap: "wrap",
                }}
              >
                <input type="checkbox" name="membershipIds" value={p.id} form="people-remove-form" />
                <span style={{ fontSize: "var(--text-sm)", flex: 1 }}>
                  {p.user.name ?? p.user.email}
                  {p.user.name && <span style={{ color: "var(--text-muted)" }}> · {p.user.email}</span>}
                </span>
                <PersonRoleEditor eventId={eventId} membershipId={p.id} role={p.role} />
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "var(--space-3)" }}>
            <RemoveSubmitButton form="people-remove-form" />
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
        </div>
      )}
    </>
  );
}
