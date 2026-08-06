"use client";

import { DataTable, type DataTableColumn } from "@service-projects/ui";
import { savePersonRoleAction, removePeopleAction, addPersonAction } from "./actions";
import type { EventMembership } from "@service-projects/database";

const ROLES = ["ADMIN", "COORDINATOR", "VOLUNTEER"] as const;

interface PersonRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

const columns: DataTableColumn<PersonRow>[] = [
  { key: "name", label: "Name", getValue: (r) => r.name },
  { key: "email", label: "Email", getValue: (r) => r.email },
  { key: "role", label: "Role", getValue: (r) => r.role, editable: true, selectOptions: [...ROLES] },
];

export function PeopleForm({ eventId, people }: { eventId: string; people: EventMembership[] }) {
  const rows: PersonRow[] = people.map((p) => ({
    id: p.id,
    name: p.user.name ?? "",
    email: p.user.email,
    role: p.role,
  }));

  return (
    <DataTable<PersonRow>
      rows={rows}
      columns={columns}
      csvFilenamePrefix={`people-${eventId}`}
      emptyMessage="No one has been added to this event yet."
      onSaveRow={(id, patch) => savePersonRoleAction(eventId, id, patch)}
      onDeleteSelected={(ids) => removePeopleAction(eventId, ids)}
      onAddRow={async (values) => {
        const result = await addPersonAction(eventId, values);
        return { ok: !result.error, error: result.error };
      }}
    />
  );
}
