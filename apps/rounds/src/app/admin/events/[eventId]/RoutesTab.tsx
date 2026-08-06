"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DataTable, type DataTableColumn } from "@service-projects/ui";
import type { RouteRow } from "@service-projects/database";
import { saveRouteRowAction, deleteRoutesAction, addRouteAction, autoSplitAction, assignVolunteerAction } from "./routeActions";

const columns: DataTableColumn<RouteRow>[] = [
  { key: "name", label: "Name", getValue: (r) => r.name, editable: true },
  { key: "status", label: "Status", getValue: (r) => r.status, editable: true, selectOptions: ["draft", "published", "in_progress", "complete"] },
  { key: "color", label: "Color", getValue: (r) => r.color, editable: true },
  { key: "stopCount", label: "Stops", getValue: (r) => String(r.stopCount) },
  { key: "assignedTo", label: "Assigned to", getValue: (r) => r.assignedTo.join(", ") },
];

export function RoutesTab({ eventId, routes }: { eventId: string; routes: RouteRow[] }) {
  const router = useRouter();
  const [routeCount, setRouteCount] = useState(3);
  const [splitting, setSplitting] = useState(false);
  const [splitMessage, setSplitMessage] = useState<string | null>(null);

  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
          Auto-split unassigned stops
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>
          Splits every stop that isn&apos;t on a route yet into geographically-grouped routes, each ordered into a
          real short path (nearest-neighbor + 2-opt).
        </p>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <input
            className="signup-input"
            type="number"
            min={1}
            style={{ width: 80 }}
            value={routeCount}
            onChange={(e) => setRouteCount(Math.max(1, Number(e.target.value) || 1))}
          />
          <Button
            type="button"
            variant="primary"
            disabled={splitting}
            onClick={async () => {
              setSplitting(true);
              const result = await autoSplitAction(eventId, routeCount);
              setSplitMessage(
                result.error ?? `Created ${result.routesCreated} route${result.routesCreated === 1 ? "" : "s"}, assigned ${result.stopsAssigned} stop${result.stopsAssigned === 1 ? "" : "s"}.`
              );
              setSplitting(false);
              router.refresh();
            }}
          >
            {splitting ? "Splitting…" : "Auto-split into routes"}
          </Button>
        </div>
        {splitMessage && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{splitMessage}</p>
        )}
      </div>

      <DataTable<RouteRow>
        rows={routes}
        columns={columns}
        csvFilenamePrefix={`routes-${eventId}`}
        emptyMessage="No routes yet — auto-split above, or add one by hand."
        onSaveRow={(id, patch) => saveRouteRowAction(eventId, id, patch)}
        onDeleteSelected={(ids) => deleteRoutesAction(eventId, ids)}
        onAddRow={(values) => addRouteAction(eventId, values)}
      />

      {routes.length > 0 && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
            Assign a volunteer to a route
          </h2>
          <div className="admin-formRow">
            <label className="signup-field" style={{ marginBottom: 0 }}>
              <span className="signup-fieldLabel">Route</span>
              <select className="signup-input" value={assignRouteId} onChange={(e) => setAssignRouteId(e.target.value)}>
                <option value="" disabled>
                  Pick a route
                </option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="signup-field" style={{ marginBottom: 0 }}>
              <span className="signup-fieldLabel">Volunteer email</span>
              <input className="signup-input" type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} />
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={assigning || !assignRouteId || !assignEmail}
              onClick={async () => {
                setAssigning(true);
                const result = await assignVolunteerAction(eventId, assignRouteId, assignEmail);
                setAssignMessage(result.error ?? "Assigned.");
                setAssigning(false);
                if (result.ok) {
                  setAssignEmail("");
                  router.refresh();
                }
              }}
            >
              {assigning ? "Assigning…" : "Assign"}
            </Button>
          </div>
          {assignMessage && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{assignMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
