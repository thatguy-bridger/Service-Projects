"use server";

import { submitSignup as submitSignupToDb, type SignupSubmission } from "@service-projects/database";

// The address step now uses Google Places Autocomplete + Geocoder
// directly in the browser (GoogleAddressPicker.tsx) instead of a
// server-round-trip to @service-projects/geo's UGRC/mock provider —
// see docs/rounds/PHASE-1.md for why. That geo package and its
// UGRC_API_KEY-backed provider are unused by this screen now, but still
// exist for other territory-related work SPEC.md §9 calls for later.

export async function submitSignup(input: SignupSubmission) {
  return submitSignupToDb(input);
}
