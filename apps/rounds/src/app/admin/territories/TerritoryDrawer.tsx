"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, Marker, Polygon } from "@vis.gl/react-google-maps";
import { Badge, Button, Card } from "@service-projects/ui";
import type { TerritoryPolygon, TerritoryRow } from "@service-projects/database";
import { previewPolygonFillAction } from "./actions";

const DRAW_COLOR = "#6f4ef0";
const EXISTING_COLOR = "#8a8a8a";
const SELECTED_POINT_COLOR = "#c0392b";

function polygonToPath(polygon: TerritoryPolygon): google.maps.LatLngLiteral[] {
  // Saved polygons repeat the first point at the end to close the ring
  // (see toPolygon() below) -- drop it here so editing doesn't show a
  // duplicate, and re-added on save.
  const ring = polygon.coordinates[0];
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  return open.map(([lng, lat]) => ({ lat, lng }));
}

// Same hand-built click-to-place-vertex approach as StopMap.tsx's lasso
// (google.maps.drawing.DrawingManager is deprecated/empty as of Maps JS
// API 3.65 — see that file's comment). Every vertex of the shape being
// drawn/edited is its own draggable Marker, not just a line on a static
// Polygon: click one to select it, drag to move it, delete it while
// selected -- editing an existing shape needs the same per-point control
// as building a new one, not just "clear everything and start over."
function DrawSurface({
  path,
  onAddPoint,
  onMovePoint,
  selectedPointIndex,
  onSelectPoint,
  existingTerritories,
  onEditExisting,
}: {
  path: google.maps.LatLngLiteral[];
  onAddPoint: (point: google.maps.LatLngLiteral) => void;
  onMovePoint: (index: number, point: google.maps.LatLngLiteral) => void;
  selectedPointIndex: number | null;
  onSelectPoint: (index: number | null) => void;
  existingTerritories: TerritoryRow[];
  onEditExisting: (territory: TerritoryRow) => void;
}) {
  return (
    <Map
      defaultCenter={{ lat: 40.6, lng: -111.9 }}
      defaultZoom={11}
      gestureHandling="greedy"
      disableDefaultUI={false}
      onClick={(e) => {
        if (e.detail.latLng) onAddPoint(e.detail.latLng);
        onSelectPoint(null);
      }}
    >
      {existingTerritories.map((t) => (
        <Polygon
          key={t.id}
          paths={t.polygon.coordinates[0].map(([lng, lat]) => ({ lat, lng }))}
          strokeColor={EXISTING_COLOR}
          strokeWeight={1.5}
          fillColor={EXISTING_COLOR}
          fillOpacity={0.06}
          onClick={() => onEditExisting(t)}
        />
      ))}
      {path.length > 0 && (
        <Polygon paths={path} strokeColor={DRAW_COLOR} strokeWeight={2} fillColor={DRAW_COLOR} fillOpacity={0.15} />
      )}
      {path.map((point, i) => (
        <Marker
          key={i}
          position={point}
          draggable
          onClick={() => onSelectPoint(selectedPointIndex === i ? null : i)}
          onDragEnd={(e) => {
            if (e.latLng) onMovePoint(i, { lat: e.latLng.lat(), lng: e.latLng.lng() });
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: selectedPointIndex === i ? 9 : 6,
            fillColor: selectedPointIndex === i ? SELECTED_POINT_COLOR : DRAW_COLOR,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          }}
        />
      ))}
    </Map>
  );
}

export function TerritoryDrawer({
  apiKey,
  onSave,
  onUpdate,
  existingTerritories,
  editTarget,
}: {
  apiKey: string;
  onSave: (name: string, polygon: TerritoryPolygon) => Promise<void>;
  onUpdate: (id: string, name: string, polygon: TerritoryPolygon) => Promise<void>;
  existingTerritories: TerritoryRow[];
  // Set by a parent that wants to jump straight into editing a
  // territory (e.g. an "Edit shape" button in the list below the map),
  // as an alternative entry point to clicking the shape on the map
  // directly. A new object reference for the same id re-triggers the
  // effect below, so the parent should only update this when the admin
  // actually asks to edit something new, not on every render.
  editTarget?: TerritoryRow | null;
}) {
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([]);
  // Points pushed off the end by undo, so redo can bring them back --
  // cleared the moment a point is added, moved, or deleted, same as any
  // editor's undo/redo stack. Only tracks *adding* points -- dragging or
  // deleting a point is a direct edit, not pushed through this stack.
  const [redoStack, setRedoStack] = useState<google.maps.LatLngLiteral[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [fillPreview, setFillPreview] = useState<{ count: number } | { error: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function addPoint(point: google.maps.LatLngLiteral) {
    setPath((prev) => [...prev, point]);
    setRedoStack([]);
    setFillPreview(null);
  }

  function movePoint(index: number, point: google.maps.LatLngLiteral) {
    setPath((prev) => prev.map((p, i) => (i === index ? point : p)));
    setFillPreview(null);
  }

  function deleteSelectedPoint() {
    if (selectedPointIndex === null) return;
    setPath((prev) => prev.filter((_, i) => i !== selectedPointIndex));
    setSelectedPointIndex(null);
    setFillPreview(null);
  }

  function undo() {
    setPath((prev) => {
      if (prev.length === 0) return prev;
      setRedoStack((redo) => [prev[prev.length - 1], ...redo]);
      return prev.slice(0, -1);
    });
    setSelectedPointIndex(null);
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

  function startEditing(territory: TerritoryRow) {
    setEditingId(territory.id);
    setName(territory.name);
    setPath(polygonToPath(territory.polygon));
    setRedoStack([]);
    setSelectedPointIndex(null);
    setFillPreview(null);
  }

  function startNew() {
    setEditingId(null);
    setName("");
    setPath([]);
    setRedoStack([]);
    setSelectedPointIndex(null);
    setFillPreview(null);
  }

  useEffect(() => {
    if (editTarget) startEditing(editTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startEditing is stable enough here; re-running it for every render (it's recreated each render) would fight the user's in-progress edits.
  }, [editTarget]);

  // Ctrl/Cmd+Z to undo the last added point, Ctrl/Cmd+Shift+Z to redo,
  // Delete/Backspace to remove whichever point is currently selected --
  // all ignored while typing in the name field.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedPointIndex !== null) {
        e.preventDefault();
        deleteSelectedPoint();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undo/redo/deleteSelectedPoint close over state via setState updater functions, not the deps themselves; re-subscribing only on selectedPointIndex (which deleteSelectedPoint actually needs fresh) is intentional.
  }, [selectedPointIndex]);

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
    if (editingId) await onUpdate(editingId, name.trim(), toPolygon());
    else await onSave(name.trim(), toPolygon());
    setSaving(false);
    startNew();
  }

  const visibleExisting = existingTerritories.filter((t) => t.id !== editingId);

  return (
    <APIProvider apiKey={apiKey}>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
            Click the map to add a point. Click a point to select it (drag to move, Delete/Backspace to remove).
            Ctrl/Cmd+Z undoes the last added point, Ctrl/Cmd+Shift+Z redoes it. Click an existing (gray) territory
            to edit it.
          </p>
          {editingId && (
            <Badge tone="accent">
              Editing — <button type="button" className="signup-linkButton" onClick={startNew} style={{ marginLeft: 4 }}>start new instead</button>
            </Badge>
          )}
        </div>
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
            onMovePoint={movePoint}
            selectedPointIndex={selectedPointIndex}
            onSelectPoint={setSelectedPointIndex}
            existingTerritories={visibleExisting}
            onEditExisting={startEditing}
          />
        </div>

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
          <Button type="button" variant="danger" onClick={deleteSelectedPoint} disabled={selectedPointIndex === null} title="Delete/Backspace">
            Delete selected point
          </Button>
          <Button type="button" variant="ghost" onClick={startNew} disabled={path.length === 0 && !editingId}>
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
            {saving ? "Saving…" : editingId ? "Save changes" : "Save territory"}
          </Button>
        </div>
      </div>
    </APIProvider>
  );
}
