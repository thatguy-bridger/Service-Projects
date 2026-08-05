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
// keystroke. No UGRC key exists in this environment yet, so this
// currently always returns the deterministic mock result — see
// packages/geo/src/mock.ts and docs/rounds/PHASE-1.md. Swapping in a
// real UGRC_API_KEY later needs no change here.
export async function geocodeAddress(addressLine: string): Promise<AddressGeocodeResult | null> {
  if (!addressLine.trim()) return null;
  const result = await getGeoProvider().geocode(addressLine);
  if (!result) return null;
  return {
    lat: result.lat,
    lng: result.lng,
    confidence: result.confidence,
    matchedAddress: result.matchedAddress,
    source: result.source,
  };
}

export async function submitSignup(input: SignupSubmission) {
  return submitSignupToDb(input);
}
