export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Normalized 0–1. UGRC's own score is documented as 0–100. */
  confidence: number;
  matchedAddress: string;
  source: "ugrc" | "mock";
}

export interface AddressPoint {
  lat: number;
  lng: number;
  addressLine: string;
}

export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

/**
 * SPEC.md §9.1: "Wrap it behind a narrow interface... UGRC is Utah-only,
 * so the day you serve a household in Idaho you need a fallback, and you
 * do not want ArcGIS response shapes in the UI layer." This is that
 * interface — app code (the address field, territory fill) depends on
 * this, never on `UgrcProvider` or `MockProvider` directly.
 */
export interface GeoProvider {
  geocode(addressLine: string, zone?: string): Promise<GeocodeResult | null>;
  reverseGeocode(lat: number, lng: number): Promise<{ addressLine: string } | null>;
  autocomplete(query: string): Promise<{ label: string }[]>;
  addressPointsInPolygon(polygon: GeoPolygon): Promise<AddressPoint[]>;
}
