import type { AddressPoint, GeocodeResult, GeoPolygon, GeoProvider } from "./types";

const BASE_URL = "https://api.mapserv.utah.gov/api/v1";

/**
 * UGRC (Utah AGRC) geocoding — SPEC.md §9.1, §9.2.
 *
 * SPEC.md is explicit: "Verify the current endpoint shapes against
 * gis.utah.gov before you build against them; do not trust my parameter
 * names." That verification was attempted here (WebSearch — gis.utah.gov
 * and api.mapserv.utah.gov both return HTTP 403 to this environment's
 * fetch tool, most likely bot protection, so their docs pages and OpenAPI
 * spec couldn't be read directly) with a real, sourced result for
 * `geocode()` and an honest "unverified" label on everything else:
 *
 * VERIFIED (via a UGRC blog post surfaced by search, with a live example
 * URL, and a second source confirming the score range):
 *   GET {BASE_URL}/geocode/{street}/{zone}?spatialReference=4326&apiKey=...
 *   - {street} and {zone} (city or ZIP) are PATH segments, not a single
 *     query param.
 *   - `score` is documented as 0–100.
 *   Source: https://gis.utah.gov/using-the-mapserv-utah-gov-api-to-geocode-address/
 *
 * NOT verified — best-effort from general knowledge of UGRC's API shape,
 * flagged so nobody mistakes this for confirmed:
 *   - The exact response JSON field names below (`location.x/y`,
 *     `score`, `matchAddress`, `locator`) are the commonly-documented
 *     AGRC/ArcGIS-style shape, not confirmed against a live response in
 *     this environment (no API key available to actually call it).
 *   - `reverseGeocode`, `autocomplete`, and `addressPointsInPolygon`
 *     below are stubbed with a thrown error rather than a guessed
 *     endpoint — SPEC.md's instruction was "verify before you build,"
 *     and guessing three more endpoint shapes with zero ability to test
 *     them against a real key felt like exactly the kind of unverified
 *     code the spec was warning against. Get a UGRC developer key
 *     (register at developer.mapserv.utah.gov, per SPEC.md §9.1) and
 *     confirm each shape at api.mapserv.utah.gov/docs/ before filling
 *     these in.
 */
export class UgrcProvider implements GeoProvider {
  constructor(private readonly apiKey: string) {}

  async geocode(addressLine: string, zone?: string): Promise<GeocodeResult | null> {
    if (!zone) {
      throw new Error(
        "UgrcProvider.geocode requires a zone (city or ZIP) — the endpoint takes it as a path segment, not part of the address string."
      );
    }
    const url = `${BASE_URL}/geocode/${encodeURIComponent(addressLine)}/${encodeURIComponent(zone)}?spatialReference=4326&apiKey=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`UGRC geocode error ${res.status}: ${await res.text()}`);
    }
    const body = await res.json();
    const result = body?.result;
    if (!result?.location) return null;
    return {
      lat: result.location.y,
      lng: result.location.x,
      confidence: typeof result.score === "number" ? result.score / 100 : 0,
      matchedAddress: result.matchAddress ?? addressLine,
      source: "ugrc",
    };
  }

  async reverseGeocode(_lat: number, _lng: number): Promise<{ addressLine: string } | null> {
    throw new Error(
      "UgrcProvider.reverseGeocode is not implemented — its endpoint shape wasn't verified. See the class-level comment."
    );
  }

  async autocomplete(_query: string): Promise<{ label: string }[]> {
    throw new Error(
      "UgrcProvider.autocomplete is not implemented — its endpoint shape wasn't verified. See the class-level comment."
    );
  }

  async addressPointsInPolygon(_polygon: GeoPolygon): Promise<AddressPoint[]> {
    throw new Error(
      "UgrcProvider.addressPointsInPolygon is not implemented — SPEC.md §9.2's territory fill needs this verified against the Open SGID address-points layer, not guessed. See the class-level comment."
    );
  }
}
