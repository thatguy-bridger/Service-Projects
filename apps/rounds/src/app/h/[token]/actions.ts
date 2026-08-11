"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  defaultOrganization,
  selfServiceUpdateNotes,
  selfServiceUpdateAddress,
  selfServiceToggleSkip,
  selfServiceCancelSubscription,
  type SelfServiceResult,
} from "@service-projects/database";
import { rateLimit, clientIpFromHeaders } from "@service-projects/core-auth";

// Every action here is authorized by token possession, not a session —
// see selfService.ts's householdForToken. No requireRole call: there is
// no session to check, by design (SPEC.md §4.4's whole point is no
// login).

// SPEC.md §20's "self-service token 30/hour", shared across the page
// load (page.tsx) and every mutating action here via the same key
// prefix -- one ceiling on self-service activity per IP, not a fresh
// 30/hour allowance per action.
function selfServiceLimited(): boolean {
  return !rateLimit(`self-service:${clientIpFromHeaders(headers())}`, 30, 60 * 60 * 1000).allowed;
}

export async function updateNotesAction(
  token: string,
  _prevState: SelfServiceResult,
  formData: FormData
): Promise<SelfServiceResult> {
  if (selfServiceLimited()) return { ok: false, error: "Too many attempts — try again later." };
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await selfServiceUpdateNotes(org.id, token, {
    placementNote: String(formData.get("placementNote") ?? "").trim() || undefined,
    accessNotes: String(formData.get("accessNotes") ?? "").trim() || undefined,
  });
  revalidatePath(`/h/${token}`);
  return result;
}

export async function updateAddressAction(
  token: string,
  addressInput: string,
  lat: number | null,
  lng: number | null,
  geocodeSource: string
): Promise<SelfServiceResult> {
  if (selfServiceLimited()) return { ok: false, error: "Too many attempts — try again later." };
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };
  if (!addressInput.trim()) return { ok: false, error: "Enter an address." };

  const result = await selfServiceUpdateAddress(org.id, token, {
    addressInput: addressInput.trim(),
    address: { matchedAddress: addressInput.trim() },
    lat,
    lng,
    geocodeSource,
  });
  revalidatePath(`/h/${token}`);
  return result;
}

export async function toggleSkipAction(token: string, subscriptionEventId: string, skipped: boolean) {
  if (selfServiceLimited()) return { ok: false, error: "Too many attempts — try again later." };
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await selfServiceToggleSkip(org.id, token, subscriptionEventId, skipped);
  revalidatePath(`/h/${token}`);
  return result;
}

export async function cancelSubscriptionAction(token: string, subscriptionId: string) {
  if (selfServiceLimited()) return { ok: false, error: "Too many attempts — try again later." };
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await selfServiceCancelSubscription(org.id, token, subscriptionId);
  revalidatePath(`/h/${token}`);
  return result;
}
