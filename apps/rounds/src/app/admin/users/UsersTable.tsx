"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";
import { deleteUsers, updateUserAction, type DeleteUsersResult, type UpdateUserResult } from "./actions";

const deleteInitialState: DeleteUsersResult = { deleted: 0, errors: [] };
const editInitialState: UpdateUserResult = { ok: false };
// Duplicated from packages/core-auth's ROLES rather than imported: that
// package's barrel also exports authOptions (server-only, pulls in
// nodemailer), which breaks the client bundle for this component.
const ROLES = ["OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER", "PREVIEWER"] as const;

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  updatedAt: Date;
}

function DeleteButton({ form }: { form: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" form={form} variant="danger" disabled={pending}>
      {pending ? t("admin.users.bulk.deleting") : t("admin.users.bulk.delete")}
    </Button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? t("admin.users.row.saving") : t("admin.users.row.save")}
    </Button>
  );
}

function UserRowEditor({ user }: { user: UserRow }) {
  const withId = updateUserAction.bind(null, user.id);
  const [state, formAction] = useFormState(withId, editInitialState);

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <input className="signup-input" name="name" defaultValue={user.name ?? ""} placeholder={t("admin.users.table.name")} style={{ minWidth: 140 }} />
      <select className="signup-input" name="role" defaultValue={user.role} style={{ minWidth: 140 }}>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <SaveButton />
      {state.ok && <span style={{ color: "var(--color-success-500)", fontSize: "var(--text-xs)" }}>{t("admin.users.row.saved")}</span>}
      {state.error && <span className="signup-error" style={{ fontSize: "var(--text-xs)" }}>{state.error}</span>}
    </form>
  );
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const [state, formAction] = useFormState(deleteUsers, deleteInitialState);

  return (
    <div>
      <form action={formAction} id="users-bulk-form" />
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
                      .querySelectorAll<HTMLInputElement>('input[name="userIds"]')
                      .forEach((cb) => (cb.checked = e.target.checked));
                  }}
                />
              </th>
              <th style={thStyle}>{t("admin.users.table.email")}</th>
              <th style={thStyle}>{t("admin.users.table.name")}</th>
              <th style={thStyle}>{t("admin.users.table.role")}</th>
              <th style={thStyle}>{t("admin.users.table.updated")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                <td style={tdStyle}>
                  <input type="checkbox" name="userIds" value={user.id} form="users-bulk-form" />
                </td>
                <td style={tdStyle}>{user.email}</td>
                <td colSpan={2} style={tdStyle}>
                  <UserRowEditor user={user} />
                </td>
                <td style={tdStyle}>{user.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        <DeleteButton form="users-bulk-form" />
      </div>

      {state.deleted > 0 && (
        <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          {t("admin.users.bulk.success", { count: state.deleted })}
        </p>
      )}
      {state.errors.length > 0 && (
        <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-5)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {state.errors.map((e, i) => (
            <li key={i}>
              {e.email}: {e.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
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
