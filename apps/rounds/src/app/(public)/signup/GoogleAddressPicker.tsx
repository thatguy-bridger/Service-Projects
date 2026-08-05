"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, Map, Marker, useMapsLibrary } from "@vis.gl/react-google-maps";
import { t } from "@/copy";

export interface PlaceResult {
  address: string;
  lat: number | null;
  lng: number | null;
}

// No API key, the Maps script failed to load, or the household just
// prefers typing — this is the fallback path with no map/pin at all.
// lat/lng go through as null (SignupSubmission.lat/lng are optional),
// and geocodeSource records "manual" so staff reviewing the Library can
// tell which rows never got a geocoded pin.
function ManualAddressEntry({
  value,
  onChange,
}: {
  value: string;
  onChange: (address: string) => void;
}) {
  return (
    <div>
      <input
        className="signup-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("signup.address.manualPlaceholder")}
      />
      <p className="signup-hint" style={{ marginTop: "var(--space-2)" }}>
        {t("signup.address.manualHint")}
      </p>
    </div>
  );
}

function AddressInput({ onSelect }: { onSelect: (result: PlaceResult) => void }) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    // Classic google.maps.places.Autocomplete widget — stable, thoroughly
    // documented, and (per Google's 2024 migration) billed under Places
    // API (New) SKUs, which is what this project enabled. The newer
    // PlaceAutocompleteElement web component was considered but skipped:
    // it's a materially different, less battle-tested API surface, and
    // this couldn't be live-tested in a browser from this environment
    // (see docs/rounds/PHASE-1.md) — the classic widget's decade of
    // stability matters more here than being maximally current.
    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location || !place.formatted_address) return;
      onSelect({ address: place.formatted_address, lat: location.lat(), lng: location.lng() });
    });
    return () => listener.remove();
  }, [places, onSelect]);

  return (
    <input
      ref={inputRef}
      className="signup-input"
      type="text"
      placeholder={t("signup.address.placeholder")}
    />
  );
}

function DraggablePin({
  lat,
  lng,
  onMove,
}: {
  lat: number;
  lng: number;
  onMove: (result: PlaceResult) => void;
}) {
  const geocodingLib = useMapsLibrary("geocoding");
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (geocodingLib) geocoderRef.current = new geocodingLib.Geocoder();
  }, [geocodingLib]);

  return (
    <Marker
      position={{ lat, lng }}
      draggable
      onDragEnd={(e) => {
        const pos = e.latLng;
        if (!pos) return;
        const newLat = pos.lat();
        const newLng = pos.lng();
        if (!geocoderRef.current) {
          onMove({ address: t("signup.address.pinMovedNoAddress"), lat: newLat, lng: newLng });
          return;
        }
        geocoderRef.current.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
          const address =
            status === "OK" && results?.[0]?.formatted_address
              ? results[0].formatted_address
              : t("signup.address.pinMovedNoAddress");
          onMove({ address, lat: newLat, lng: newLng });
        });
      }}
    />
  );
}

export function GoogleAddressPicker({
  place,
  onSelect,
  onMove,
}: {
  place: PlaceResult | null;
  onSelect: (result: PlaceResult) => void;
  onMove: (result: PlaceResult) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [mapReady, setMapReady] = useState(false);
  // Household can always drop to manual entry — no API key, the map
  // failed to load, or they just can't find their address on it. Once
  // an API key exists in every environment this is a nice-to-have, not
  // the load-bearing fallback it is until then.
  const [manual, setManual] = useState(!apiKey);

  if (manual || !apiKey) {
    return (
      <div>
        <ManualAddressEntry
          value={place?.address ?? ""}
          onChange={(address) => onSelect({ address, lat: null, lng: null })}
        />
        {apiKey && (
          <button
            type="button"
            className="signup-linkButton"
            onClick={() => setManual(false)}
            style={{ marginTop: "var(--space-2)" }}
          >
            {t("signup.address.useMap")}
          </button>
        )}
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places", "geocoding"]} onLoad={() => setMapReady(true)}>
      <AddressInput onSelect={onSelect} />
      {place && mapReady && place.lat !== null && place.lng !== null && (
        <div
          style={{
            height: 260,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--border-default)",
            marginTop: "var(--space-3)",
          }}
        >
          <Map
            defaultCenter={{ lat: place.lat, lng: place.lng }}
            center={{ lat: place.lat, lng: place.lng }}
            defaultZoom={17}
            gestureHandling="greedy"
            disableDefaultUI
          >
            <DraggablePin lat={place.lat} lng={place.lng} onMove={onMove} />
          </Map>
        </div>
      )}
      <button
        type="button"
        className="signup-linkButton"
        onClick={() => setManual(true)}
        style={{ marginTop: "var(--space-2)" }}
      >
        {t("signup.address.enterManually")}
      </button>
    </APIProvider>
  );
}
