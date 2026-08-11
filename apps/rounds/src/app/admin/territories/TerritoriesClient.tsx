"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@service-projects/ui";
import type { TerritoryRow, TerritoryPolygon } from "@service-projects/database";
import {
  createTerritoryAction,
  renameTerritoryAction,
  updateTerritoryAction,
  deleteTerritoryAction,
  previewTerritoryFillAction,
} from "./actions";
import { TerritoryDrawer } from "./TerritoryDrawer";

export function TerritoriesClient({ initialRows, apiKey }: { initialRows: TerritoryRow[]; apiKey: string | undefined }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<TerritoryRow | null>(null);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
          Draw a new territory
        </h2>
        {apiKey ? (
          <TerritoryDrawer
            apiKey={apiKey}
            existingTerritories={initialRows}
            editTarget={editTarget}
            onSave={async (name, polygon: TerritoryPolygon) => {
              const result = await createTerritoryAction(name, polygon);
              setMessage(result.error ?? `Saved "${name}".`);
              setEditTarget(null);
              router.refresh();
            }}
            onUpdate={async (id, name, polygon: TerritoryPolygon) => {
              const result = await updateTerritoryAction(id, name, polygon);
              setMessage(result.error ?? `Saved changes to "${name}".`);
              setEditTarget(null);
              router.refresh();
            }}
          />
        ) : (
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Set NEXT_PUBLIC_GOOGLE_MAPS_API to draw territories here.
          </p>
        )}
        {message && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{message}</p>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
          Saved territories
        </h2>
        {initialRows.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            No territories saved yet — draw one above.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {initialRows.map((t) => (
              <Card key={t.id} style={{ padding: "var(--space-4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  {renamingId === t.id ? (
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flex: 1, minWidth: 200 }}>
                      <input
                        className="signup-input"
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="primary"
                        onClick={async () => {
                          const result = await renameTerritoryAction(t.id, renameValue);
                          setMessage(result.error ?? null);
                          setRenamingId(null);
                          router.refresh();
                        }}
                      >
                        Save
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setRenamingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <strong>{t.name}</strong>
                      <p style={{ margin: "2px 0 0", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {t.addressPointCount !== null
                          ? `${t.addressPointCount.toLocaleString()} addresses (checked ${t.lastFilledAt ? new Date(t.lastFilledAt).toLocaleDateString() : ""})`
                          : "Not checked yet — import address points below, then check fill count."}
                      </p>
                    </div>
                  )}
                  {renamingId !== t.id && (
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <Button type="button" variant="secondary" onClick={() => setEditTarget(t)}>
                        Edit shape
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={fillingId === t.id}
                        onClick={async () => {
                          setFillingId(t.id);
                          const result = await previewTerritoryFillAction(t.id);
                          setMessage(
                            result.ok
                              ? `${t.name}: ${result.count?.toLocaleString()} address points inside.`
                              : (result.error ?? "Could not check fill count.")
                          );
                          setFillingId(null);
                          router.refresh();
                        }}
                      >
                        {fillingId === t.id ? "Checking…" : "Check fill count"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setRenamingId(t.id);
                          setRenameValue(t.name);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={async () => {
                          if (!window.confirm(`Delete territory "${t.name}"?`)) return;
                          const result = await deleteTerritoryAction(t.id);
                          setMessage(result.error ?? null);
                          router.refresh();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
