"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { t } from "@/copy";

export interface PlaceResult {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

// Nominatim (OpenStreetMap's free geocoder) — no API key, no billing
// account, works the moment this ships. Usage policy caps unauthenticated
// browser use at ~1 request/second, which the 400ms debounce below
// respects; this app's signup volume (a few households a day) is nowhere
// near that ceiling. If that ever changes, swap this for a self-hosted
// Nominatim or a paid geocoder behind the same fetch shape — nothing else
// in the app depends on this file directly.
async function searchAddress(query: string): Promise<NominatimResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  return res.json();
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.display_name ?? null;
}

function AddressSearchInput({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (result: PlaceResult) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(value), [value]);

  function handleChange(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddress(next);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="signup-input"
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("signup.address.placeholder")}
        autoComplete="off"
      />
      {loading && (
        <span className="signup-hint" style={{ position: "absolute", right: 12, top: 10, margin: 0 }}>
          {t("signup.address.searching")}
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--surface-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            listStyle: "none",
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(s.display_name);
                  setOpen(false);
                  onSelect({ address: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "var(--space-2) var(--space-3)",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 4 && !loading && suggestions.length === 0 && (
        <button
          type="button"
          className="signup-linkButton"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect({ address: query.trim(), lat: null, lng: null })}
          style={{ marginTop: "var(--space-2)" }}
        >
          {t("signup.address.useAsTyped")}
        </button>
      )}
    </div>
  );
}

// Leaflet map + draggable pin — dynamically built client-side only
// (Leaflet touches `window` at import time, which breaks SSR) and with a
// hand-drawn SVG pin instead of Leaflet's default marker images, which
// need asset-path configuration to survive a bundler. No API key, no
// billing, tiles from OpenStreetMap's public tile servers.
function LeafletPinMap({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (result: PlaceResult) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const pinIcon = L.divIcon({
        html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26c0-8.8-7.2-16-16-16z" style="fill:var(--color-accent-500)"/>
          <circle cx="16" cy="16" r="6" fill="#fff"/>
        </svg>`,
        className: "",
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        const address = await reverseGeocode(pos.lat, pos.lng).catch(() => null);
        onMove({ address: address ?? t("signup.address.pinMovedNoAddress"), lat: pos.lat, lng: pos.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; re-centering on prop change is handled below
  }, []);

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lng]);
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 280,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border-default)",
        marginTop: "var(--space-3)",
      }}
    />
  );
}

export function OSMAddressPicker({
  place,
  onSelect,
  onMove,
}: {
  place: PlaceResult | null;
  onSelect: (result: PlaceResult) => void;
  onMove: (result: PlaceResult) => void;
}) {
  return (
    <div>
      <AddressSearchInput value={place?.address ?? ""} onSelect={onSelect} />
      {place && place.lat !== null && place.lng !== null && (
        <>
          <p className="signup-hint" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
            {t("signup.address.dragHint")}
          </p>
          <LeafletPinMap lat={place.lat} lng={place.lng} onMove={onMove} />
        </>
      )}
    </div>
  );
}
