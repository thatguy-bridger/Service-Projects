"use client";

import { GoogleAddressPicker } from "./GoogleAddressPicker";
import { OSMAddressPicker, type PlaceResult } from "./OSMAddressPicker";

export type { PlaceResult };

// Google when a key is configured (better autocomplete/coverage), the
// free OSM/Nominatim + Leaflet path otherwise — so this always works,
// with no environment-specific code at the call site.
export function AddressPicker(props: {
  place: PlaceResult | null;
  onSelect: (result: PlaceResult) => void;
  onMove: (result: PlaceResult) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API;
  if (apiKey) return <GoogleAddressPicker apiKey={apiKey} {...props} />;
  return <OSMAddressPicker {...props} />;
}
