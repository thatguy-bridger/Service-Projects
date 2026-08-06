import { randomBytes } from "node:crypto";
import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";
import { hashToken } from "./households";
import type { Role } from "@prisma/client";

export interface InviteKeyRow {
  id: string;
  codePrefix: string;
  grantsRole: Role;
  eventId: string | null;
  eventName: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  note: string | null;
  revoked: boolean;
}

export async function inviteKeysForOrg(
  session: SessionLike | null | undefined,
  orgId: string
): Promise<InviteKeyRow[]> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];

  const keys = await prisma.inviteKey.findMany({
    where: { orgId },
    include: { event: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return keys.map((k) => ({
    id: k.id,
    codePrefix: k.codePrefix,
    grantsRole: k.grantsRole,
    eventId: k.eventId,
    eventName: k.event?.name ?? null,
    maxUses: k.maxUses,
    useCount: k.useCount,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString().slice(0, 10) : null,
    note: k.note,
    revoked: !!k.revokedAt,
  }));
}

export interface CreateInviteKeyResult {
  ok: boolean;
  error?: string;
  rawCode?: string; // shown once, never stored
}

export async function createInviteKey(
  session: SessionLike | null | undefined,
  input: {
    orgId: string;
    eventId?: string | null;
    grantsRole: Role;
    maxUses?: number;
    expiresAt?: Date;
    note?: string;
  }
): Promise<CreateInviteKeyResult> {
  const membership = await resolveMembership(session, input.eventId ?? undefined);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  // Only an Owner can grant the Owner role — same rule as /admin/users.
  if (input.grantsRole === "OWNER" && membership.role !== "OWNER") {
    return { ok: false, error: "Only an Owner can issue an Owner-granting key." };
  }

  const raw = randomBytes(16).toString("base64url"); // ~22 chars, URL-safe
  const key = await prisma.inviteKey.create({
    data: {
      orgId: input.orgId,
      eventId: input.eventId || null,
      codeHash: hashToken(raw),
      codePrefix: raw.slice(0, 6),
      grantsRole: input.grantsRole,
      maxUses: input.maxUses ?? 1,
      expiresAt: input.expiresAt,
      note: input.note,
      createdBy: session!.user!.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: session!.user!.id,
      action: "invite_key.created",
      entity: "InviteKey",
      entityId: key.id,
      after: { grantsRole: input.grantsRole, eventId: input.eventId ?? null, maxUses: input.maxUses ?? 1 },
    },
  });

  return { ok: true, rawCode: raw };
}

export async function revokeInviteKeys(
  session: SessionLike | null | undefined,
  orgId: string,
  keyIds: string[]
): Promise<{ deleted: number }> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { deleted: 0 };

  const result = await prisma.inviteKey.updateMany({
    where: { id: { in: keyIds }, orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  for (const keyId of keyIds) {
    await prisma.auditLog.create({
      data: { orgId, actorId: session!.user!.id, action: "invite_key.revoked", entity: "InviteKey", entityId: keyId },
    });
  }

  return { deleted: result.count };
}

export interface RedeemKeyResult {
  ok: boolean;
  error?: string;
  grantedRole?: Role;
  eventId?: string | null;
}

// Public-facing (the caller only needs to be signed in, not staff) --
// possession of the raw code plus a real account is what grants the
// role, exactly like Household's self-service token. Every failure
// path (expired, revoked, exhausted, already redeemed) is checked
// before anything is written, so a redemption either fully succeeds or
// changes nothing.
export async function redeemInviteKey(
  session: SessionLike | null | undefined,
  rawCode: string
): Promise<RedeemKeyResult> {
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in first." };

  const key = await prisma.inviteKey.findUnique({ where: { codeHash: hashToken(rawCode) } });
  if (!key) return { ok: false, error: "That key doesn't exist, or the link is wrong." };
  if (key.revokedAt) return { ok: false, error: "This key has been revoked." };
  if (key.expiresAt && key.expiresAt < new Date()) return { ok: false, error: "This key has expired." };
  if (key.useCount >= key.maxUses) return { ok: false, error: "This key has already been fully redeemed." };

  const already = await prisma.keyRedemption.findUnique({
    where: { keyId_userId: { keyId: key.id, userId } },
  });
  if (already) return { ok: false, error: "You've already redeemed this key." };

  // Prisma's composite unique (orgId, userId, role, eventId) can't be used
  // as an upsert `where` when eventId is null — Postgres composite unique
  // constraints don't match NULLs that way, so Prisma won't generate that
  // accessor for it. Look the row up manually instead.
  const existingMembership = await prisma.membership.findFirst({
    where: { orgId: key.orgId, userId, role: key.grantsRole, eventId: key.eventId ?? null },
  });

  await prisma.$transaction([
    prisma.keyRedemption.create({ data: { keyId: key.id, userId } }),
    prisma.inviteKey.update({ where: { id: key.id }, data: { useCount: { increment: 1 } } }),
    existingMembership
      ? prisma.membership.update({ where: { id: existingMembership.id }, data: { status: "active" } })
      : prisma.membership.create({
          data: {
            orgId: key.orgId,
            userId,
            role: key.grantsRole,
            eventId: key.eventId,
            grantedBy: null,
            grantedViaKeyId: key.id,
          },
        }),
    prisma.auditLog.create({
      data: {
        orgId: key.orgId,
        actorId: userId,
        action: "invite_key.redeemed",
        entity: "InviteKey",
        entityId: key.id,
        after: { role: key.grantsRole, eventId: key.eventId },
      },
    }),
  ]);

  return { ok: true, grantedRole: key.grantsRole, eventId: key.eventId };
}
