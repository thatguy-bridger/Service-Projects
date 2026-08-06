"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { redeemInviteKey, type RedeemKeyResult } from "@service-projects/database";
import { capabilityCard, type CapabilityCardEntry } from "@service-projects/core-auth";

export async function redeemInviteKeyAction(rawCode: string): Promise<RedeemKeyResult> {
  const session = await getServerSession(authOptions);
  return redeemInviteKey(session, rawCode);
}

export async function capabilityCardAction(role: Parameters<typeof capabilityCard>[0]): Promise<CapabilityCardEntry[]> {
  return capabilityCard(role);
}
