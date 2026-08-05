"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { deleteUsers, type DeleteUsersResult } from "./actions";

const initialState: DeleteUsersResult = { deleted: 0, errors: [] };

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  updatedAt: Date;
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? t("admin.users.bulk.deleting") : t("admin.users.bulk.delete")}
    </Button>
  );
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const [state, formAction] = useFormState(deleteUsers, initialState);

  return (
    <form action={formAction}>
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
                  <input type="checkbox" name="userIds" value={user.id} />
                </td>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>{user.name ?? "—"}</td>
                <td style={tdStyle}>
                  <Badge tone="accent">{user.role}</Badge>
                </td>
                <td style={tdStyle}>{user.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
        <DeleteButton />
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
    </form>
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
