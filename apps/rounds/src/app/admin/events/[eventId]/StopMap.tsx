"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, Marker, Polygon, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Button } from "@service-projects/ui";
import type { RouteRow } from "@service-projects/database";
import type { MapStop } from "./RoutesTab";

const UNASSIGNED_COLOR = "#8a8a8a";

function colorForStop(stop: MapStop, routeColorById: Map<string, string>): string {
  if (stop.routeId) return routeColorById.get(stop.routeId) ?? "#6f4ef0";
  return UNASSIGNED_COLOR;
}

// Fits the map to every stop once, on load -- imperative because
// fitBounds isn't a prop, it's a one-time camera command.
function FitToStops({ stops }: { stops: MapStop[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || fitted.current || stops.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const s of stops) bounds.extend({ lat: s.lat, lng: s.lng });
    map.fitBounds(bounds, 40);
    fitted.current = true;
  }, [map, stops]);

  return null;
}

// The lasso itself. Google deprecated the old DrawingManager class (no
// constructor/methods left as of Maps JS API 3.65), so this builds the
// same "click to place a vertex, close the loop, see what's inside"
// interaction by hand: each map click while drawing appends a vertex,
// clicking back near the first vertex (or the Finish button) closes the
// polygon, and geometry.poly.containsLocation does the point-in-polygon
// test per stop, same as it always would have.
function LassoDrawing({
  active,
  stops,
  onComplete,
}: {
  active: boolean;
  stops: MapStop[];
  onComplete: (stopIds: string[]) => void;
}) {
  const map = useMap();
  const geometryLib = useMapsLibrary("geometry");
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([]);

  useEffect(() => {
    if (!active) setPath([]);
  }, [active]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!active || !e.latLng) return;
      setPath((prev) => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
    });
    return () => listener.remove();
  }, [map, active]);

  function finish() {
    if (!geometryLib || path.length < 3) return;
    const polygon = new google.maps.Polygon({ paths: path });
    const inside = stops.filter((s) =>
      geometryLib.poly.containsLocation(new google.maps.LatLng(s.lat, s.lng), polygon)
    );
    onComplete(inside.map((s) => s.id));
    setPath([]);
  }

  if (!active) return null;

  return (
    <>
      {path.length > 0 && (
        <Polygon
          paths={path}
          strokeColor="#6f4ef0"
          strokeWeight={2}
          fillColor="#6f4ef0"
          fillOpacity={0.15}
          clickable={false}
        />
      )}
      <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: 8 }}>
        <span
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "6px 12px",
            fontSize: "var(--text-sm)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          Click the map to place points ({path.length} so far) — needs at least 3
        </span>
        <Button type="button" variant="primary" disabled={path.length < 3} onClick={finish}>
          Finish shape
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPath([])} disabled={path.length === 0}>
          Undo all
        </Button>
      </div>
    </>
  );
}

export function StopMap({
  apiKey,
  stops,
  routes,
  onAssignToRoute,
  onCreateRoute,
}: {
  apiKey: string;
  stops: MapStop[];
  routes: RouteRow[];
  onAssignToRoute: (routeId: string, stopIds: string[]) => Promise<void>;
  onCreateRoute: (name: string, stopIds: string[]) => Promise<void>;
}) {
  const [drawing, setDrawing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetRouteId, setTargetRouteId] = useState("");
  const [newRouteName, setNewRouteName] = useState("");
  const [busy, setBusy] = useState(false);

  const routeColorById = new globalThis.Map(routes.map((r) => [r.id, r.color] as const));

  if (stops.length === 0) {
    return <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>No stops yet to show on a map.</p>;
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["geometry"]}>
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
            Gray pins are unassigned; colored pins already belong to a route.
          </p>
          <Button
            type="button"
            variant={drawing ? "danger" : "secondary"}
            onClick={() => {
              setDrawing((d) => !d);
              setSelectedIds([]);
            }}
          >
            {drawing ? "Cancel lasso" : "Draw a lasso"}
          </Button>
        </div>
        <div
          style={{
            position: "relative",
            height: 480,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--border-default)",
          }}
        >
          <Map
            defaultCenter={{ lat: stops[0].lat, lng: stops[0].lng }}
            defaultZoom={12}
            gestureHandling={drawing ? "none" : "greedy"}
            disableDefaultUI={false}
          >
            <FitToStops stops={stops} />
            <LassoDrawing
              active={drawing}
              stops={stops}
              onComplete={(ids) => {
                setSelectedIds(ids);
                setDrawing(false);
              }}
            />
            {stops.map((s) => (
              <Marker
                key={s.id}
                position={{ lat: s.lat, lng: s.lng }}
                title={s.addressLine}
                opacity={selectedIds.includes(s.id) ? 1 : selectedIds.length > 0 ? 0.35 : 1}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: selectedIds.includes(s.id) ? 8 : 6,
                  fillColor: colorForStop(s, routeColorById),
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: selectedIds.includes(s.id) ? 2 : 1,
                }}
              />
            ))}
          </Map>
        </div>

        {selectedIds.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-end" }}>
            <strong style={{ fontSize: "var(--text-sm)" }}>{selectedIds.length} stops selected</strong>

            <label className="signup-field" style={{ marginBottom: 0, minWidth: 200 }}>
              <span className="signup-fieldLabel">Add to existing route</span>
              <select className="signup-input" value={targetRouteId} onChange={(e) => setTargetRouteId(e.target.value)}>
                <option value="">Pick a route</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={!targetRouteId || busy}
              onClick={async () => {
                setBusy(true);
                await onAssignToRoute(targetRouteId, selectedIds);
                setBusy(false);
                setSelectedIds([]);
                setTargetRouteId("");
              }}
            >
              Add to route
            </Button>

            <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>or</span>

            <label className="signup-field" style={{ marginBottom: 0, minWidth: 200 }}>
              <span className="signup-fieldLabel">New route name</span>
              <input className="signup-input" type="text" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} />
            </label>
            <Button
              type="button"
              variant="primary"
              disabled={!newRouteName.trim() || busy}
              onClick={async () => {
                setBusy(true);
                await onCreateRoute(newRouteName.trim(), selectedIds);
                setBusy(false);
                setSelectedIds([]);
                setNewRouteName("");
              }}
            >
              Create route from selection
            </Button>

            <Button type="button" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear selection
            </Button>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
