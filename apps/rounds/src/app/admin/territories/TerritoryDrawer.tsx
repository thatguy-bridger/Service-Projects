"use client";

import { useState } from "react";
import { APIProvider, Map, Polygon } from "@vis.gl/react-google-maps";
import { Button } from "@service-projects/ui";
import type { TerritoryPolygon } from "@service-projects/database";

// Same hand-built click-to-place-vertex approach as StopMap.tsx's lasso
// (google.maps.drawing.DrawingManager is deprecated/empty as of Maps JS
// API 3.65 — see that file's comment) — no stops to select here, just a
// shape to save, so this is simpler: draw, name it, save.
function DrawSurface({
  path,
  onAddPoint,
}: {
  path: google.maps.LatLngLiteral[];
  onAddPoint: (point: google.maps.LatLngLiteral) => void;
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
      {path.length > 0 && (
        <Polygon paths={path} strokeColor="#6f4ef0" strokeWeight={2} fillColor="#6f4ef0" fillOpacity={0.15} />
      )}
    </Map>
  );
}

export function TerritoryDrawer({
  apiKey,
  onSave,
}: {
  apiKey: string;
  onSave: (name: string, polygon: TerritoryPolygon) => Promise<void>;
}) {
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (path.length < 3 || !name.trim()) return;
    setSaving(true);
    const polygon: TerritoryPolygon = {
      type: "Polygon",
      coordinates: [[...path.map((p) => [p.lng, p.lat] as [number, number]), [path[0].lng, path[0].lat]]],
    };
    await onSave(name.trim(), polygon);
    setSaving(false);
    setPath([]);
    setName("");
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
          Click the map to place points, then name and save the shape below. Needs at least 3 points.
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
          <DrawSurface path={path} onAddPoint={(point) => setPath((prev) => [...prev, point])} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-end" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{path.length} point{path.length === 1 ? "" : "s"}</span>
          <Button type="button" variant="ghost" onClick={() => setPath([])} disabled={path.length === 0}>
            Undo all
          </Button>
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
