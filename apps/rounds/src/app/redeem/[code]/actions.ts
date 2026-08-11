"use server";

import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, rateLimit, clientIpFromHeaders, hashIp } from "@service-projects/core-auth";
import { redeemInviteKey, type RedeemKeyResult } from "@service-projects/database";
import { capabilityCard, type CapabilityCardEntry } from "@service-projects/core-auth";

// SPEC.md §3.3: "Rate-limit redemption to 5/account/hour and 20/IP/hour."
// Both checked -- an attacker with many accounts is capped by IP, one
// account guessing across many codes is capped by account.
export async function redeemInviteKeyAction(rawCode: string): Promise<RedeemKeyResult> {
  const session = await getServerSession(authOptions);
  const ip = clientIpFromHeaders(headers());

  const ipLimit = rateLimit(`redeem-ip:${ip}`, 20, 60 * 60 * 1000);
  if (!ipLimit.allowed) return { ok: false, error: "Too many attempts — try again later." };

  const userId = session?.user?.id;
  if (userId) {
    const userLimit = rateLimit(`redeem-user:${userId}`, 5, 60 * 60 * 1000);
    if (!userLimit.allowed) return { ok: false, error: "Too many attempts — try again later." };
  }

  return redeemInviteKey(session, rawCode, hashIp(ip));
}

export async function capabilityCardAction(role: Parameters<typeof capabilityCard>[0]): Promise<CapabilityCardEntry[]> {
  return capabilityCard(role);
}
