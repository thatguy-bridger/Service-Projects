"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, Marker, Polygon, useMap } from "@vis.gl/react-google-maps";
import { Badge, Button, Card } from "@service-projects/ui";
import type { AddressPointPin, SignedUpHouseholdPin, TerritoryPolygon, TerritoryRow } from "@service-projects/database";
import {
  previewPolygonFillAction,
  addressPointsInBoundsAction,
  addressPointsInPolygonAction,
  signedUpHouseholdsInBoundsAction,
  signedUpHouseholdsInPolygonAction,
} from "./actions";

const DRAW_COLOR = "#6f4ef0";
const EXISTING_COLOR = "#8a8a8a";
const SELECTED_POINT_COLOR = "#c0392b";

// Reads the app's actual theme accent color rather than hardcoding a
// hex value here, so the pins stay in sync with it if the palette ever
// changes. Falls back to the token's known value if the CSS variable
// isn't there yet (shouldn't happen once the stylesheet's loaded, but
// an empty fillColor would just be another invisible-pin bug).
function getThemeAccentColor(): string {
  if (typeof window === "undefined") return "#ff563c";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-accent-500").trim();
  return value || "#ff563c";
}

// A real pin shape (24x24-ish viewBox), built from only M/C/c/z --
// Google Maps' custom Symbol path parser does NOT support SVG arc
// commands (A/a); the more common Material "place" glyph path uses two
// of them for its outer teardrop and inner hole, which the parser
// silently fails to render at all (no error, just an invisible icon --
// this is what "the count is right but no pins show" actually was).
// This is the same pin shape with both circles approximated as cubic
// beziers instead. anchor sits at the tip so the pin actually points at
// its coordinate instead of floating above it.
const PIN_SVG_PATH =
  "M12 2 C8.13 2 5 5.13 5 9 c0 5.25 7 13 7 13 0 0 7-7.75 7-13 0-3.87-3.13-7-7-7 z " +
  "M12 11.5 C10.62 11.5 9.5 10.38 9.5 9 9.5 7.62 10.62 6.5 12 6.5 c1.38 0 2.5 1.12 2.5 2.5 0 1.38-1.12 2.5-2.5 2.5 z";

// Below this zoom level a real viewport can span an entire city, which
// is exactly the "map turns into a smear of dots" case this is meant to
// avoid -- only start plotting individual addresses once the admin is
// zoomed in far enough that a screenful of them is actually legible.
const ADDRESS_PIN_MIN_ZOOM = 16;

/**
 * Plots imported AddressPoint rows as pins, in one of two modes:
 *
 * - A territory is selected/being edited (filterPolygon set): shows only
 *   that shape's own addresses (a real ST_Contains query, not just a
 *   bounding box), regardless of zoom or what else is in the viewport --
 *   selecting a territory should narrow the map down to it, not just
 *   layer another filter on top of "whatever's on screen." Refetches
 *   (debounced) whenever the shape itself changes.
 * - Nothing selected (filterPolygon null): the original viewport
 *   behavior -- past ADDRESS_PIN_MIN_ZOOM, refetches from the current
 *   viewport on every pan/zoom (debounced) via the "idle" event, the
 *   same event Maps JS fires once a drag/zoom gesture has settled.
 */
export type AddressPinStatus =
  | { state: "below-zoom"; zoom: number }
  | { state: "loading" }
  | { state: "ok"; count: number; truncated: boolean }
  | { state: "error"; message: string };

interface PinResult<T> {
  points: T[];
  truncated: boolean;
}

/**
 * Shared fetch/debounce logic behind both pin layers (imported
 * AddressPoint rows and signed-up Household pins) -- same two modes
 * for each:
 *
 * - A territory is selected/being edited (filterPolygon set): fetches
 *   only that shape's own points (a real ST_Contains query, not just a
 *   bounding box), regardless of zoom or what else is in the viewport
 *   -- selecting a territory should narrow the map down to it, not
 *   just layer another filter on top of "whatever's on screen."
 *   Refetches (debounced) whenever the shape itself changes.
 * - Nothing selected (filterPolygon null): fetches from the current
 *   viewport once past minZoom, refetching (debounced) on every pan/
 *   zoom via the "idle" event -- the same event Maps JS fires once a
 *   drag/zoom gesture has settled.
 */
function usePinLayer<T>({
  filterPolygon,
  minZoom,
  fetchBounds,
  fetchPolygon,
  onStatusChange,
}: {
  filterPolygon: TerritoryPolygon | null;
  minZoom: number;
  fetchBounds: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => Promise<PinResult<T>>;
  fetchPolygon: (polygon: TerritoryPolygon) => Promise<PinResult<T>>;
  onStatusChange: (status: AddressPinStatus) => void;
}): T[] {
  const map = useMap();
  const [pins, setPins] = useState<T[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Polygon mode.
  useEffect(() => {
    if (!filterPolygon) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      onStatusChange({ state: "loading" });
      fetchPolygon(filterPolygon)
        .then((result) => {
          if (requestId !== requestIdRef.current) return;
          setPins(result.points);
          onStatusChange({ state: "ok", count: result.points.length, truncated: result.truncated });
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;
          setPins([]);
          onStatusChange({ state: "error", message: err instanceof Error ? err.message : "Could not load addresses." });
        });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPolygon/onStatusChange are stable enough (module-level action + a setState wrapper) that including them would just re-run this on every render.
  }, [filterPolygon]);

  // Viewport mode -- only active while nothing is selected.
  useEffect(() => {
    if (filterPolygon || !map) return;

    function refresh() {
      const zoom = map!.getZoom();
      const bounds = map!.getBounds();
      if (!zoom || zoom < minZoom || !bounds) {
        setPins([]);
        onStatusChange({ state: "below-zoom", zoom: zoom ?? 0 });
        return;
      }
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const requestId = ++requestIdRef.current;
      onStatusChange({ state: "loading" });
      fetchBounds({
        minLat: sw.lat(),
        maxLat: ne.lat(),
        minLng: sw.lng(),
        maxLng: ne.lng(),
      })
        .then((result) => {
          // A slower earlier request can resolve after a newer one --
          // drop it instead of flickering back to a stale viewport's pins.
          if (requestId !== requestIdRef.current) return;
          setPins(result.points);
          onStatusChange({ state: "ok", count: result.points.length, truncated: result.truncated });
        })
        .catch((err: unknown) => {
          // A silently-dropped rejection here (auth expiring mid-session,
          // a server error) previously looked exactly like "the pins just
          // aren't loading" with nothing on screen to explain why --
          // surface it instead of swallowing it.
          if (requestId !== requestIdRef.current) return;
          setPins([]);
          onStatusChange({ state: "error", message: err instanceof Error ? err.message : "Could not load addresses." });
        });
    }

    function onIdle() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refresh, 300);
    }

    const listener = map.addListener("idle", onIdle);
    refresh();
    return () => {
      listener.remove();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchBounds/onStatusChange are stable enough (module-level action + a setState wrapper) that including them would just re-add the same idle listener over and over.
  }, [map, filterPolygon, minZoom]);

  return pins;
}

function AddressPointPins({
  filterPolygon,
  onStatusChange,
}: {
  filterPolygon: TerritoryPolygon | null;
  onStatusChange: (status: AddressPinStatus) => void;
}) {
  const pinColor = useMemo(() => getThemeAccentColor(), []);
  const pins = usePinLayer<AddressPointPin>({
    filterPolygon,
    minZoom: ADDRESS_PIN_MIN_ZOOM,
    fetchBounds: addressPointsInBoundsAction,
    fetchPolygon: addressPointsInPolygonAction,
    onStatusChange,
  });

  return (
    <>
      {pins.map((p, i) => (
        <Marker
          key={`${p.lat},${p.lng},${i}`}
          position={{ lat: p.lat, lng: p.lng }}
          title={p.fullAddress}
          icon={{
            path: PIN_SVG_PATH,
            scale: 0.9,
            anchor: new google.maps.Point(12, 22),
            fillColor: pinColor,
            fillOpacity: 0.9,
            strokeColor: "#fff",
            strokeWeight: 1,
          }}
        />
      ))}
    </>
  );
}

// Households that have already signed up (a real Household.lat/lng, not
// just imported reference data) are the whole reason to look at this
// map -- rendered bigger, in a distinct color, and with a real tooltip
// (name + the address they typed) so one is unmistakable from the
// smaller, plainer imported-address pins around it, not just another
// dot in the same style.
const SIGNED_UP_PIN_COLOR = "#1a73e8";

function SignedUpHouseholdPins({
  filterPolygon,
  onStatusChange,
}: {
  filterPolygon: TerritoryPolygon | null;
  onStatusChange: (status: AddressPinStatus) => void;
}) {
  const pins = usePinLayer<SignedUpHouseholdPin>({
    filterPolygon,
    minZoom: ADDRESS_PIN_MIN_ZOOM,
    fetchBounds: signedUpHouseholdsInBoundsAction,
    fetchPolygon: signedUpHouseholdsInPolygonAction,
    onStatusChange,
  });

  return (
    <>
      {pins.map((p) => (
        <Marker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          title={`${p.contactName} — ${p.addressInput}`}
          zIndex={1000}
          icon={{
            path: PIN_SVG_PATH,
            scale: 1.5,
            anchor: new google.maps.Point(12, 22),
            fillColor: SIGNED_UP_PIN_COLOR,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          }}
        />
      ))}
    </>
  );
}

function pathToPolygon(path: google.maps.LatLngLiteral[]): TerritoryPolygon {
  return {
    type: "Polygon",
    coordinates: [[...path.map((p) => [p.lng, p.lat] as [number, number]), [path[0].lng, path[0].lat]]],
  };
}

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
  filterPolygon,
  onPinStatusChange,
  onSignedUpStatusChange,
}: {
  path: google.maps.LatLngLiteral[];
  onAddPoint: (point: google.maps.LatLngLiteral) => void;
  onMovePoint: (index: number, point: google.maps.LatLngLiteral) => void;
  selectedPointIndex: number | null;
  onSelectPoint: (index: number | null) => void;
  existingTerritories: TerritoryRow[];
  onEditExisting: (territory: TerritoryRow) => void;
  filterPolygon: TerritoryPolygon | null;
  onPinStatusChange: (status: AddressPinStatus) => void;
  onSignedUpStatusChange: (status: AddressPinStatus) => void;
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
      <AddressPointPins filterPolygon={filterPolygon} onStatusChange={onPinStatusChange} />
      <SignedUpHouseholdPins filterPolygon={filterPolygon} onStatusChange={onSignedUpStatusChange} />
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
  const [pinStatus, setPinStatus] = useState<AddressPinStatus | null>(null);
  const [signedUpStatus, setSignedUpStatus] = useState<AddressPinStatus | null>(null);

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
    return pathToPolygon(path);
  }

  // Only recomputed when the shape itself actually changes (add/move/
  // delete a point, or loading a different territory to edit) -- a
  // stable reference here matters, since AddressPointPins uses it as an
  // effect dependency and a fresh object every render would refetch on
  // every keystroke in the name field.
  const filterPolygon = useMemo(() => (path.length >= 3 ? pathToPolygon(path) : null), [path]);

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
            to edit it, which also narrows the address pins down to just that territory. Otherwise, zoom in past
            street level to see individual imported addresses as pins. Larger blue pins are households that have
            already signed up — hover one for their name and address.
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
            filterPolygon={filterPolygon}
            onPinStatusChange={setPinStatus}
            onSignedUpStatusChange={setSignedUpStatus}
          />
          {(pinStatus || signedUpStatus) && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                pointerEvents: "none",
              }}
            >
              {signedUpStatus && signedUpStatus.state === "ok" && signedUpStatus.count > 0 && (
                <div
                  style={{
                    background: SIGNED_UP_PIN_COLOR,
                    color: "#fff",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-medium)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {signedUpStatus.count} signed-up address{signedUpStatus.count === 1 ? "" : "es"}
                  {signedUpStatus.truncated ? " (more not shown)" : ""}
                  {filterPolygon ? " in this territory" : " in view"}
                </div>
              )}
              {pinStatus && (
                <div
                  style={{
                    background: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    fontSize: "var(--text-xs)",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {pinStatus.state === "below-zoom" &&
                    `Zoom in to street level to see addresses (zoom ${pinStatus.zoom}/${ADDRESS_PIN_MIN_ZOOM})`}
                  {pinStatus.state === "loading" && "Loading addresses…"}
                  {pinStatus.state === "error" && `Couldn't load addresses: ${pinStatus.message}`}
                  {pinStatus.state === "ok" &&
                    (pinStatus.truncated
                      ? `Showing ${pinStatus.count} of more — zoom in further to see every address${filterPolygon ? " in this territory" : " in view"}`
                      : pinStatus.count === 0
                        ? `No imported addresses ${filterPolygon ? "in this territory" : "in this view"}`
                        : `${pinStatus.count} address${pinStatus.count === 1 ? "" : "es"} ${filterPolygon ? "in this territory" : "in view"}`)}
                </div>
              )}
            </div>
          )}
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
