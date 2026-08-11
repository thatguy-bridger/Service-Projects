"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, clientIpFromHeaders, hashIp } from "@service-projects/core-auth";
import {
  defaultOrganization,
  createInviteKey,
  revokeInviteKeys,
  type CreateInviteKeyResult,
} from "@service-projects/database";
import type { Role } from "@prisma/client";

export async function createInviteKeyAction(input: {
  grantsRole: Role;
  eventId: string | null;
  maxUses: number;
  expiresAt: string | null;
  note: string | null;
}): Promise<CreateInviteKeyResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };

  const result = await createInviteKey(session, {
    orgId: org.id,
    eventId: input.eventId,
    grantsRole: input.grantsRole,
    maxUses: input.maxUses,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    note: input.note || undefined,
    ipHash: hashIp(clientIpFromHeaders(headers())),
  });
  revalidatePath("/admin/keys");
  return result;
}

export async function revokeInviteKeysAction(ids: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { deleted: 0 };
  const result = await revokeInviteKeys(session, org.id, ids, hashIp(clientIpFromHeaders(headers())));
  revalidatePath("/admin/keys");
  return result;
}
