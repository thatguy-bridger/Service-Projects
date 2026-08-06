"use client";

import { useEffect, useRef } from "react";
import { APIProvider, Map, Marker, useMapsLibrary } from "@vis.gl/react-google-maps";
import { t } from "@/copy";
import type { PlaceResult } from "./OSMAddressPicker";

// google.maps.places.Autocomplete (the classic widget) is deprecated as
// of March 2025 — new Cloud projects can't even authorize a key for the
// legacy "Places API" it depends on, only "Places API (New)" — so this
// uses its replacement, the gmp-place-autocomplete web component
// (google.maps.places.PlaceAutocompleteElement), which runs on Places
// API (New). It's a real custom element, not a React component the
// library wraps yet, hence building it with the DOM directly rather
// than JSX.
function AddressInput({ onSelect }: { onSelect: (result: PlaceResult) => void }) {
  const places = useMapsLibrary("places");
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  useEffect(() => {
    if (!places || !containerRef.current || elementRef.current) return;

    const el = new places.PlaceAutocompleteElement({ placeholder: t("signup.address.placeholder") });
    el.className = "signup-input";
    containerRef.current.appendChild(el);
    elementRef.current = el;

    const listener = (event: google.maps.places.PlacePredictionSelectEvent) => {
      const place = event.placePrediction.toPlace();
      place
        .fetchFields({ fields: ["formattedAddress", "location"] })
        .then(({ place: fetched }) => {
          if (!fetched.location || !fetched.formattedAddress) return;
          onSelect({
            address: fetched.formattedAddress,
            lat: fetched.location.lat(),
            lng: fetched.location.lng(),
          });
        })
        .catch(() => {
          // Field fetch failed (rate limit, transient network error) —
          // leave the previous selection in place rather than clearing it.
        });
    };
    el.addEventListener("gmp-select", listener);

    return () => {
      // removeEventListener's typings don't carry the custom-event map
      // addEventListener's overload does — same listener reference either way.
      (el as unknown as HTMLElement).removeEventListener("gmp-select", listener as EventListener);
      el.remove();
      elementRef.current = null;
    };
  }, [places, onSelect]);

  return <div ref={containerRef} />;
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

// Used when NEXT_PUBLIC_GOOGLE_MAPS_API is set (see AddressPicker.tsx,
// which picks this over OSMAddressPicker.tsx whenever a key exists).
// Google's address coverage/autocomplete quality is the reason to use
// this over the free OSM path when a key is available; OSM stays the
// automatic, zero-config fallback for any environment without one.
export function GoogleAddressPicker({
  apiKey,
  place,
  onSelect,
  onMove,
}: {
  apiKey: string;
  place: PlaceResult | null;
  onSelect: (result: PlaceResult) => void;
  onMove: (result: PlaceResult) => void;
}) {
  return (
    <APIProvider apiKey={apiKey} libraries={["places", "geocoding"]}>
      <AddressInput onSelect={onSelect} />
      {place && place.lat !== null && place.lng !== null && (
        <>
          <p className="signup-hint" style={{ marginTop: "var(--space-2)", marginBottom: 0 }}>
            {t("signup.address.dragHint")}
          </p>
          <div
            style={{
              height: 280,
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
        </>
      )}
    </APIProvider>
  );
}
