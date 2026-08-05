"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

// A colored dot instead of Leaflet's default marker image — sidesteps
// the well-known "broken marker icon" issue with bundlers (Leaflet's
// default icon is a relative image path that doesn't survive webpack),
// and matches the design language's accent color instead of Leaflet's
// stock blue pin.
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--color-accent-500);
    border: 3px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  const lastCenter = useRef<string>("");
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (lastCenter.current === key) return;
    lastCenter.current = key;
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function AddressMap({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  return (
    <div style={{ height: 260, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
      <MapContainer center={[lat, lng]} zoom={17} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng();
              onMove(pos.lat, pos.lng);
            },
          }}
        />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}
