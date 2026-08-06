"use server";

import { headers } from "next/headers";
import { submitSignup as submitSignupToDb, type SignupSubmission } from "@service-projects/database";
import { rateLimit, clientIpFromHeaders } from "@/lib/rateLimit";

// The address step resolves in the browser via AddressPicker.tsx: Google
// Places/Geocoder when NEXT_PUBLIC_GOOGLE_MAPS_API is set, Nominatim
// (OpenStreetMap, no key) otherwise — instead of a server-round-trip to
// @service-projects/geo's UGRC/mock provider. That geo package and its
// UGRC_API_KEY-backed provider are unused by this screen now, but still
// exist for other territory-related work SPEC.md §9 calls for later.

// This is a public, unauthenticated write with no CAPTCHA or other
// bot-defense in front of it — a script could otherwise flood
// Household/Subscription rows with junk. "RATE_LIMITED:<seconds>" is a
// stable-prefix message (not a thrown custom class — server actions
// don't reliably preserve error subclasses across the client/server
// boundary) that SignupFlow.tsx checks for to show a specific message.
export async function submitSignup(input: SignupSubmission) {
  const ip = clientIpFromHeaders(headers());
  const { allowed, retryAfterSeconds } = rateLimit(`signup:${ip}`, 5, 10 * 60 * 1000);
  if (!allowed) {
    throw new Error(`RATE_LIMITED:${retryAfterSeconds ?? 60}`);
  }
  return submitSignupToDb(input);
}
