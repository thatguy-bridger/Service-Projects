"use server";

import { revalidatePath } from "next/cache";
import {
  defaultOrganization,
  selfServiceUpdateNotes,
  selfServiceUpdateAddress,
  selfServiceToggleSkip,
  selfServiceCancelSubscription,
  type SelfServiceResult,
} from "@service-projects/database";

// Every action here is authorized by token possession, not a session —
// see selfService.ts's householdForToken. No requireRole call: there is
// no session to check, by design (SPEC.md §4.4's whole point is no
// login).

export async function updateNotesAction(
  token: string,
  _prevState: SelfServiceResult,
  formData: FormData
): Promise<SelfServiceResult> {
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
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await selfServiceToggleSkip(org.id, token, subscriptionEventId, skipped);
  revalidatePath(`/h/${token}`);
  return result;
}

export async function cancelSubscriptionAction(token: string, subscriptionId: string) {
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization set up yet." };

  const result = await selfServiceCancelSubscription(org.id, token, subscriptionId);
  revalidatePath(`/h/${token}`);
  return result;
}
