"use server";

import { getGeoProvider } from "@service-projects/geo";
import { submitSignup as submitSignupToDb, type SignupSubmission } from "@service-projects/database";

export interface AddressGeocodeResult {
  lat: number;
  lng: number;
  confidence: number;
  matchedAddress: string;
  source: "ugrc" | "mock";
}

// Called as the address step loses focus / on demand, not on every
// keystroke. Uses whichever provider getGeoProvider() picks — the real
// UgrcProvider if UGRC_API_KEY is set (see docs/rounds/PHASE-1.md for
// the current state of that), MockProvider otherwise.
//
// `zone` (city or ZIP) is required, not optional: UgrcProvider.geocode
// throws without one — UGRC's endpoint takes it as a separate path
// segment, not part of the address string (packages/geo/src/ugrc.ts).
export async function geocodeAddress(addressLine: string, zone: string): Promise<AddressGeocodeResult | null> {
  if (!addressLine.trim() || !zone.trim()) return null;
  const result = await getGeoProvider().geocode(addressLine, zone);
  if (!result) return null;
  return {
    lat: result.lat,
    lng: result.lng,
    confidence: result.confidence,
    matchedAddress: result.matchedAddress,
    source: result.source,
  };
}

// Drives the "drag the pin" interaction: called with the marker's new
// coordinates after a drag, returns the address at that point so the
// visitor sees what they're actually confirming, not just a lat/lng.
//
// UgrcProvider.reverseGeocode is deliberately unimplemented (its shape
// was never verified against UGRC's docs — see packages/geo/src/ugrc.ts)
// and throws. Caught here rather than left to crash the request: with a
// real UGRC key active, dragging the pin keeps showing the original
// geocoded address instead of updating — an honest degradation, not a
// silent wrong answer. MockProvider (no UGRC key) does update on drag.
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const result = await getGeoProvider().reverseGeocode(lat, lng);
    return result?.addressLine ?? null;
  } catch {
    return null;
  }
}

export async function submitSignup(input: SignupSubmission) {
  return submitSignupToDb(input);
}
