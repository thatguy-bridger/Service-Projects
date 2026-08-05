import type { AddressPoint, GeocodeResult, GeoPolygon, GeoProvider } from "./types";

// Deterministic center for the mock — roughly Sandy, UT, matching where
// the seed script (packages/database/prisma/seed.mjs) places its data.
const MOCK_CENTER = { lat: 40.5649, lng: -111.8674 };

function hashToUnit(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (h % 10000) / 10000;
}

/**
 * Used automatically when `UGRC_API_KEY` isn't set (see `getGeoProvider`
 * in index.ts) — dev environments and this sandbox included, since no
 * real UGRC key exists here. Deterministic (same input -> same output)
 * so it's usable in tests, not just "doesn't crash."
 */
export class MockProvider implements GeoProvider {
  async geocode(addressLine: string): Promise<GeocodeResult | null> {
    const jitter = hashToUnit(addressLine);
    return {
      lat: MOCK_CENTER.lat + (jitter - 0.5) * 0.05,
      lng: MOCK_CENTER.lng + (hashToUnit(addressLine + "lng") - 0.5) * 0.05,
      confidence: 0.9,
      matchedAddress: addressLine,
      source: "mock",
    };
  }

  async reverseGeocode(lat: number, lng: number): Promise<{ addressLine: string } | null> {
    return { addressLine: `Near ${lat.toFixed(4)}, ${lng.toFixed(4)} (mock)` };
  }

  async autocomplete(query: string): Promise<{ label: string }[]> {
    if (!query.trim()) return [];
    return [{ label: `${query} (mock suggestion)` }];
  }

  async addressPointsInPolygon(_polygon: GeoPolygon): Promise<AddressPoint[]> {
    return [];
  }
}
