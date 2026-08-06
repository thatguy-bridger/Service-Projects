"use client";

import { useState } from "react";
import { Card, Button, DataTable, type DataTableColumn } from "@service-projects/ui";
import { formatCentsFull } from "@/lib/format";
import type { HouseholdForEvent, EventStatus, EventMembership } from "@service-projects/database";
import {
  saveSignupRowAction,
  deleteSignupsAction,
  importSignupsCsvAction,
  saveEventDatesRowAction,
  deleteEventAction,
  setEventCategoryAction,
} from "./tableActions";
import { PeopleForm } from "./PeopleForm";
import { GenerateStopsButton } from "./GenerateStopsButton";

const TABS = ["Event Dates", "Service Sign Ups", "Member Purchases", "Settings"] as const;
type Tab = (typeof TABS)[number];

interface SignupRow {
  id: string; // subscriptionEventId
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressInput: string;
  placementNote: string;
  accessNotes: string;
  subscriptionStatus: string;
  amountCents: number;
  skipped: string;
}

function toSignupRows(rows: HouseholdForEvent[]): SignupRow[] {
  return rows.map((r) => ({
    id: r.subscriptionEventId,
    contactName: r.household.contactName,
    contactEmail: r.household.contactEmail ?? "",
    contactPhone: r.household.contactPhone ?? "",
    addressInput: r.household.addressInput,
    placementNote: r.household.placementNote ?? "",
    accessNotes: r.household.accessNotes ?? "",
    subscriptionStatus: r.subscriptionStatus,
    amountCents: r.amountCents,
    skipped: r.skipped ? "yes" : "no",
  }));
}

const SUB_STATUSES = ["DRAFT", "PENDING_PAYMENT", "ACTIVE", "LAPSED", "CANCELLED"];

const signupColumns: DataTableColumn<SignupRow>[] = [
  { key: "contactName", label: "Name", getValue: (r) => r.contactName, editable: true },
  { key: "contactEmail", label: "Email", getValue: (r) => r.contactEmail, editable: true },
  { key: "contactPhone", label: "Phone", getValue: (r) => r.contactPhone, editable: true },
  { key: "addressInput", label: "Address", getValue: (r) => r.addressInput, editable: true },
  { key: "placementNote", label: "Placement note", getValue: (r) => r.placementNote, editable: true },
  { key: "accessNotes", label: "Access notes", getValue: (r) => r.accessNotes, editable: true },
  {
    key: "subscriptionStatus",
    label: "Permission (status)",
    getValue: (r) => r.subscriptionStatus,
    editable: true,
    selectOptions: SUB_STATUSES,
  },
  { key: "skipped", label: "Skipped", getValue: (r) => r.skipped, editable: true, selectOptions: ["no", "yes"] },
];

const purchaseColumns: DataTableColumn<SignupRow>[] = [
  { key: "contactName", label: "Name", getValue: (r) => r.contactName },
  { key: "amountDisplay", label: "Amount", getValue: (r) => formatCentsFull(r.amountCents) },
  { key: "amountCents", label: "Amount (edit, $)", getValue: (r) => (r.amountCents / 100).toFixed(2), editable: true, inputType: "number" },
  { key: "subscriptionStatus", label: "Status", getValue: (r) => r.subscriptionStatus, editable: true, selectOptions: SUB_STATUSES },
];

interface EventDatesRow {
  id: string;
  name: string;
  status: EventStatus;
  serviceStartsAt: string;
  serviceEndsAt: string;
}

const eventDatesColumns: DataTableColumn<EventDatesRow>[] = [
  { key: "name", label: "Name", getValue: (r) => r.name, editable: true },
  { key: "status", label: "Status", getValue: (r) => r.status, editable: true, selectOptions: ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] },
  { key: "serviceStartsAt", label: "Starts", getValue: (r) => r.serviceStartsAt, editable: true, inputType: "date" },
  { key: "serviceEndsAt", label: "Ends", getValue: (r) => r.serviceEndsAt, editable: true, inputType: "date" },
];

export function EventDetailTabs({
  eventId,
  seasonId,
  eventDatesRow,
  signupRows,
  people,
  categories,
  currentCategoryId,
}: {
  eventId: string;
  seasonId: string | null;
  eventDatesRow: EventDatesRow;
  signupRows: HouseholdForEvent[];
  people: EventMembership[];
  categories: { id: string; name: string }[];
  currentCategoryId: string | null;
}) {
  const [tab, setTab] = useState<Tab>("Service Sign Ups");
  const [deleting, setDeleting] = useState(false);
  const [categoryId, setCategoryId] = useState(currentCategoryId ?? "");
  const [categorySaved, setCategorySaved] = useState(false);

  const rows = toSignupRows(signupRows);

  return (
    <Card>
      <div className="admin-tabs" style={{ marginBottom: "var(--space-4)" }}>
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            className={`admin-tab${tab === name ? " admin-tab--active" : ""}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "Event Dates" && (
        <DataTable<EventDatesRow>
          rows={[eventDatesRow]}
          columns={eventDatesColumns}
          csvFilenamePrefix={`event-dates-${eventId}`}
          onSaveRow={(id, patch) => saveEventDatesRowAction(eventId, id, patch)}
        />
      )}

      {tab === "Service Sign Ups" && (
        <>
          <DataTable<SignupRow>
            rows={rows}
            columns={signupColumns}
            csvFilenamePrefix={`signups-${eventId}`}
            emptyMessage="No signups yet."
            onSaveRow={(id, patch) => saveSignupRowAction(eventId, id, patch)}
            onDeleteSelected={(ids) => deleteSignupsAction(eventId, ids)}
            onImportCsv={seasonId ? (csv) => importSignupsCsvAction(eventId, seasonId, csv) : undefined}
          />
          <div style={{ marginTop: "var(--space-6)" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>People on this event</h2>
            <PeopleForm eventId={eventId} people={people} />
          </div>
        </>
      )}

      {tab === "Member Purchases" && (
        <DataTable<SignupRow>
          rows={rows}
          columns={purchaseColumns}
          csvFilenamePrefix={`purchases-${eventId}`}
          emptyMessage="No purchases yet."
          onSaveRow={(id, patch) => saveSignupRowAction(eventId, id, patch)}
        />
      )}

      {tab === "Settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 480 }}>
          <div>
            <label className="signup-field">
              <span className="signup-fieldLabel">Category</span>
              <select
                className="signup-input"
                value={categoryId}
                onChange={async (e) => {
                  const next = e.target.value;
                  setCategoryId(next);
                  setCategorySaved(false);
                  const result = await setEventCategoryAction(eventId, next);
                  setCategorySaved(result.ok);
                }}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {categorySaved && (
              <p style={{ color: "var(--color-success-500)", fontSize: "var(--text-sm)" }}>Saved.</p>
            )}
          </div>

          {seasonId && (
            <div>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
                Generate stops
              </h2>
              <GenerateStopsButton eventId={eventId} />
            </div>
          )}

          <div>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
              Delete this event
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
              Removes it from every list. Signups already recorded aren&apos;t deleted.
            </p>
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={async () => {
                if (!window.confirm("Delete this event? This can't be undone from here.")) return;
                setDeleting(true);
                const result = await deleteEventAction(eventId);
                if (result.ok) window.location.href = "/admin/events";
                else setDeleting(false);
              }}
            >
              {deleting ? "Deleting…" : "Delete event"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
