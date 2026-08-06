"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { saveUserRowAction, deleteUsersAction, addUserAction } from "./actions";

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

const columns: DataTableColumn<UserRow>[] = [
  { key: "email", label: "Email", getValue: (r) => r.email, editable: true },
  { key: "name", label: "Name", getValue: (r) => r.name ?? "", editable: true },
  { key: "role", label: "Role", getValue: (r) => r.role, editable: true, selectOptions: [...ROLES] },
  { key: "updatedAt", label: "Updated", getValue: (r) => r.updatedAt.toLocaleDateString() },
];

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <DataTable<UserRow>
      rows={users}
      columns={columns}
      csvFilenamePrefix="users"
      emptyMessage="No users yet."
      onSaveRow={(id, patch) => saveUserRowAction(id, patch)}
      onDeleteSelected={(ids) => deleteUsersAction(ids)}
      onAddRow={(values) => addUserAction(values)}
    />
  );
}
