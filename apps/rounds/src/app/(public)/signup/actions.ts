"use server";

import { submitSignup as submitSignupToDb, type SignupSubmission } from "@service-projects/database";

// The address step uses Nominatim (OpenStreetMap) search/reverse-geocode
// directly in the browser (OSMAddressPicker.tsx) instead of a
// server-round-trip to @service-projects/geo's UGRC/mock provider — no
// API key required, so it works with zero configuration. That geo
// package and its UGRC_API_KEY-backed provider are unused by this screen
// now, but still exist for other territory-related work SPEC.md §9 calls
// for later.

export async function submitSignup(input: SignupSubmission) {
  return submitSignupToDb(input);
}
