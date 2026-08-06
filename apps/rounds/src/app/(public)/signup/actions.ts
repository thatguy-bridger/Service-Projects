"use server";

import { submitSignup as submitSignupToDb, type SignupSubmission } from "@service-projects/database";

// The address step resolves in the browser via AddressPicker.tsx: Google
// Places/Geocoder when NEXT_PUBLIC_GOOGLE_MAPS_API is set, Nominatim
// (OpenStreetMap, no key) otherwise — instead of a server-round-trip to
// @service-projects/geo's UGRC/mock provider. That geo package and its
// UGRC_API_KEY-backed provider are unused by this screen now, but still
// exist for other territory-related work SPEC.md §9 calls for later.

export async function submitSignup(input: SignupSubmission) {
  return submitSignupToDb(input);
}
