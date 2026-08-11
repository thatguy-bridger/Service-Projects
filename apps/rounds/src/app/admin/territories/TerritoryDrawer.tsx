"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, Polygon } from "@vis.gl/react-google-maps";
import { Badge, Button, Card } from "@service-projects/ui";
import type { TerritoryPolygon, TerritoryRow } from "@service-projects/database";
import { previewPolygonFillAction } from "./actions";

const DRAW_COLOR = "#6f4ef0";
const EXISTING_COLOR = "#8a8a8a";
const SELECTED_COLOR = "#2f8ed9";

// Same hand-built click-to-place-vertex approach as StopMap.tsx's lasso
// (google.maps.drawing.DrawingManager is deprecated/empty as of Maps JS
// API 3.65 — see that file's comment) — no stops to select here, just a
// shape to save, so this is simpler: draw, name it, save. Also renders
// every already-saved territory underneath as a reference overlay
// (clickable to highlight), so an admin drawing a new shape can see
// where existing ones are instead of guessing from the list below.
function DrawSurface({
  path,
  onAddPoint,
  existingTerritories,
  selectedExistingId,
  onSelectExisting,
}: {
  path: google.maps.LatLngLiteral[];
  onAddPoint: (point: google.maps.LatLngLiteral) => void;
  existingTerritories: TerritoryRow[];
  selectedExistingId: string | null;
  onSelectExisting: (id: string | null) => void;
}) {
  return (
    <Map
      defaultCenter={{ lat: 40.6, lng: -111.9 }}
      defaultZoom={11}
      gestureHandling="greedy"
      disableDefaultUI={false}
      onClick={(e) => {
        if (e.detail.latLng) onAddPoint(e.detail.latLng);
      }}
    >
      {existingTerritories.map((t) => (
        <Polygon
          key={t.id}
          paths={t.polygon.coordinates[0].map(([lng, lat]) => ({ lat, lng }))}
          strokeColor={selectedExistingId === t.id ? SELECTED_COLOR : EXISTING_COLOR}
          strokeWeight={selectedExistingId === t.id ? 3 : 1.5}
          fillColor={selectedExistingId === t.id ? SELECTED_COLOR : EXISTING_COLOR}
          fillOpacity={selectedExistingId === t.id ? 0.18 : 0.06}
          onClick={() => onSelectExisting(selectedExistingId === t.id ? null : t.id)}
        />
      ))}
      {path.length > 0 && (
        <Polygon paths={path} strokeColor={DRAW_COLOR} strokeWeight={2} fillColor={DRAW_COLOR} fillOpacity={0.15} />
      )}
    </Map>
  );
}

export function TerritoryDrawer({
  apiKey,
  onSave,
  existingTerritories,
}: {
  apiKey: string;
  onSave: (name: string, polygon: TerritoryPolygon) => Promise<void>;
  existingTerritories: TerritoryRow[];
}) {
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([]);
  // Points pushed off the end by undo, so redo can bring them back --
  // cleared the moment a new point is placed, same as any editor's
  // undo/redo stack (redoing after a fresh edit makes no sense).
  const [redoStack, setRedoStack] = useState<google.maps.LatLngLiteral[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null);
  const [fillPreview, setFillPreview] = useState<{ count: number } | { error: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function addPoint(point: google.maps.LatLngLiteral) {
    setPath((prev) => [...prev, point]);
    setRedoStack([]);
    setFillPreview(null);
  }

  function undo() {
    setPath((prev) => {
      if (prev.length === 0) return prev;
      setRedoStack((redo) => [prev[prev.length - 1], ...redo]);
      return prev.slice(0, -1);
    });
    setFillPreview(null);
  }

  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      setPath((path) => [...path, prev[0]]);
      return prev.slice(1);
    });
    setFillPreview(null);
  }

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z to redo -- ignored while typing
  // in the name field so undo there still means "undo my typing," not
  // "delete my last map point."
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toPolygon(): TerritoryPolygon {
    return {
      type: "Polygon",
      coordinates: [[...path.map((p) => [p.lng, p.lat] as [number, number]), [path[0].lng, path[0].lat]]],
    };
  }

  async function previewFill() {
    setPreviewing(true);
    const result = await previewPolygonFillAction(toPolygon());
    setFillPreview(result.ok ? { count: result.count ?? 0 } : { error: result.error ?? "Could not check." });
    setPreviewing(false);
  }

  async function save() {
    if (path.length < 3 || !name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), toPolygon());
    setSaving(false);
    setPath([]);
    setRedoStack([]);
    setName("");
    setFillPreview(null);
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
          Click the map to place points (needs at least 3). Ctrl/Cmd+Z to undo a point, Ctrl/Cmd+Shift+Z to redo.
          Existing territories are shown in gray — click one to highlight it.
        </p>
        <div
          style={{
            position: "relative",
            height: 420,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--border-default)",
          }}
        >
          <DrawSurface
            path={path}
            onAddPoint={addPoint}
            existingTerritories={existingTerritories}
            selectedExistingId={selectedExistingId}
            onSelectExisting={setSelectedExistingId}
          />
        </div>

        {selectedExistingId && (
          <Card style={{ padding: "var(--space-3) var(--space-4)" }}>
            {(() => {
              const t = existingTerritories.find((x) => x.id === selectedExistingId);
              if (!t) return null;
              return (
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <strong>{t.name}</strong>
                  <Badge tone="neutral">
                    {t.addressPointCount !== null ? `${t.addressPointCount.toLocaleString()} addresses` : "not checked yet"}
                  </Badge>
                </span>
              );
            })()}
          </Card>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {path.length} point{path.length === 1 ? "" : "s"}
          </span>
          <Button type="button" variant="ghost" onClick={undo} disabled={path.length === 0} title="Ctrl/Cmd+Z">
            Undo
          </Button>
          <Button type="button" variant="ghost" onClick={redo} disabled={redoStack.length === 0} title="Ctrl/Cmd+Shift+Z">
            Redo
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setPath([]);
              setRedoStack([]);
              setFillPreview(null);
            }}
            disabled={path.length === 0}
          >
            Clear
          </Button>
          <Button type="button" variant="secondary" disabled={path.length < 3 || previewing} onClick={previewFill}>
            {previewing ? "Checking…" : "Preview address count"}
          </Button>
        </div>

        {fillPreview && (
          <Card style={{ padding: "var(--space-3) var(--space-4)" }}>
            {"count" in fillPreview ? (
              <span>
                <strong>{fillPreview.count.toLocaleString()}</strong> imported address
                {fillPreview.count === 1 ? "" : "es"} fall inside this shape.
              </span>
            ) : (
              <span style={{ color: "var(--color-danger-500)" }}>{fillPreview.error}</span>
            )}
          </Card>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-end" }}>
          <label className="signup-field" style={{ marginBottom: 0, minWidth: 200 }}>
            <span className="signup-fieldLabel">Territory name</span>
            <input className="signup-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="button" variant="primary" disabled={path.length < 3 || !name.trim() || saving} onClick={save}>
            {saving ? "Saving…" : "Save territory"}
          </Button>
        </div>
      </div>
    </APIProvider>
  );
}
