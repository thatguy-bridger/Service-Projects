import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { inviteKeysForOrg, createInviteKey, revokeInviteKeys, redeemInviteKey } = await import("../inviteKeys");

beforeEach(() => {
  vi.clearAllMocks();
});

const COORDINATOR = { user: { id: "u-coord", role: "COORDINATOR" as const } };
const OWNER = { user: { id: "u-owner", role: "OWNER" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("inviteKeysForOrg", () => {
  it("a signed-out visitor gets nothing", async () => {
    const result = await inviteKeysForOrg(null, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.inviteKey.findMany).not.toHaveBeenCalled();
  });

  it("a non-staff member gets nothing", async () => {
    const result = await inviteKeysForOrg(VOLUNTEER, "org-1");
    expect(result).toEqual([]);
    expect(prismaMock.inviteKey.findMany).not.toHaveBeenCalled();
  });
});

describe("createInviteKey", () => {
  it("rejects a non-staff caller", async () => {
    const result = await createInviteKey(VOLUNTEER, { orgId: "org-1", grantsRole: "VOLUNTEER" as never });
    expect(result.ok).toBe(false);
    expect(prismaMock.inviteKey.create).not.toHaveBeenCalled();
  });

  it("refuses to let a non-Owner staff member issue an Owner-granting key", async () => {
    const result = await createInviteKey(COORDINATOR, { orgId: "org-1", grantsRole: "OWNER" as never });
    expect(result.ok).toBe(false);
    expect(prismaMock.inviteKey.create).not.toHaveBeenCalled();
  });

  it("lets an Owner issue an Owner-granting key and returns the raw code exactly once", async () => {
    prismaMock.inviteKey.create.mockResolvedValueOnce({ id: "key-1" });
    const result = await createInviteKey(OWNER, { orgId: "org-1", grantsRole: "OWNER" as never });
    expect(result.ok).toBe(true);
    expect(result.rawCode).toBeTruthy();
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("passes an ipHash through to the audit log when given one", async () => {
    prismaMock.inviteKey.create.mockResolvedValueOnce({ id: "key-1" });
    await createInviteKey(OWNER, { orgId: "org-1", grantsRole: "VOLUNTEER" as never, ipHash: "abc123" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ipHash: "abc123" }) })
    );
  });

  it("a coordinator can issue a lower-privilege key and it stores a hash, not the raw code", async () => {
    prismaMock.inviteKey.create.mockResolvedValueOnce({ id: "key-2" });
    const result = await createInviteKey(COORDINATOR, { orgId: "org-1", grantsRole: "VOLUNTEER" as never });
    expect(result.ok).toBe(true);
    const call = prismaMock.inviteKey.create.mock.calls[0][0];
    expect(call.data.codeHash).not.toEqual(result.rawCode);
  });
});

describe("revokeInviteKeys", () => {
  it("rejects a non-staff caller", async () => {
    const result = await revokeInviteKeys(VOLUNTEER, "org-1", ["key-1"]);
    expect(result.deleted).toBe(0);
    expect(prismaMock.inviteKey.updateMany).not.toHaveBeenCalled();
  });

  it("scopes revocation to the org and writes an audit log per key", async () => {
    prismaMock.inviteKey.updateMany.mockResolvedValueOnce({ count: 2 });
    const result = await revokeInviteKeys(COORDINATOR, "org-1", ["key-1", "key-2"]);
    expect(result.deleted).toBe(2);
    expect(prismaMock.inviteKey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: "org-1" }) })
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("passes an ipHash through to each audit log row when given one", async () => {
    prismaMock.inviteKey.updateMany.mockResolvedValueOnce({ count: 1 });
    await revokeInviteKeys(OWNER, "org-1", ["key-1"], "abc123");
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ipHash: "abc123" }) })
    );
  });
});

describe("redeemInviteKey", () => {
  it("rejects a signed-out caller", async () => {
    const result = await redeemInviteKey(null, "raw-code");
    expect(result.ok).toBe(false);
    expect(prismaMock.inviteKey.findUnique).not.toHaveBeenCalled();
  });

  it("fails if the code doesn't match any key", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce(null);
    const result = await redeemInviteKey(VOLUNTEER, "bad-code");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // SPEC.md §3.3: "deliberately vague failure messages" -- a
  // nonexistent, revoked, expired, and fully-redeemed code must all
  // fail with the exact same message, so trying codes can't be used to
  // learn which ones are/were real.
  it("gives the same vague message for a nonexistent, revoked, expired, or fully-redeemed code", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce(null);
    const notFound = await redeemInviteKey(VOLUNTEER, "bad-code");

    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1", orgId: "org-1", eventId: null, grantsRole: "VOLUNTEER",
      maxUses: 1, useCount: 0, expiresAt: null, revokedAt: new Date(),
    });
    const revoked = await redeemInviteKey(VOLUNTEER, "raw-code");

    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1", orgId: "org-1", eventId: null, grantsRole: "VOLUNTEER",
      maxUses: 1, useCount: 0, expiresAt: new Date("2000-01-01"), revokedAt: null,
    });
    const expired = await redeemInviteKey(VOLUNTEER, "raw-code");

    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1", orgId: "org-1", eventId: null, grantsRole: "VOLUNTEER",
      maxUses: 1, useCount: 1, expiresAt: null, revokedAt: null,
    });
    const exhausted = await redeemInviteKey(VOLUNTEER, "raw-code");

    expect(notFound.ok).toBe(false);
    expect(revoked.ok).toBe(false);
    expect(expired.ok).toBe(false);
    expect(exhausted.ok).toBe(false);
    expect(new Set([notFound.error, revoked.error, expired.error, exhausted.error]).size).toBe(1);
  });

  it("fails if this user already redeemed the key", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      orgId: "org-1",
      eventId: null,
      grantsRole: "VOLUNTEER",
      maxUses: 5,
      useCount: 1,
      expiresAt: null,
      revokedAt: null,
    });
    prismaMock.keyRedemption.findUnique.mockResolvedValueOnce({ id: "redemption-1" });
    const result = await redeemInviteKey(VOLUNTEER, "raw-code");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("succeeds and grants the role via a single transaction", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      orgId: "org-1",
      eventId: null,
      grantsRole: "VOLUNTEER",
      maxUses: 5,
      useCount: 1,
      expiresAt: null,
      revokedAt: null,
    });
    prismaMock.keyRedemption.findUnique.mockResolvedValueOnce(null);
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    const result = await redeemInviteKey(VOLUNTEER, "raw-code");
    expect(result).toEqual({ ok: true, grantedRole: "VOLUNTEER", eventId: null });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("includes the given ipHash in the redemption's audit log entry", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      orgId: "org-1",
      eventId: null,
      grantsRole: "VOLUNTEER",
      maxUses: 5,
      useCount: 1,
      expiresAt: null,
      revokedAt: null,
    });
    prismaMock.keyRedemption.findUnique.mockResolvedValueOnce(null);
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    await redeemInviteKey(VOLUNTEER, "raw-code", "abc123");
    const transactionCalls = prismaMock.$transaction.mock.calls[0][0];
    // The transaction is an array of Prisma operation promises built via
    // prisma.auditLog.create(...) -- confirm that call happened with the
    // ipHash, same way the create/revoke tests check auditLog.create.
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ipHash: "abc123", action: "invite_key.redeemed" }) })
    );
    expect(transactionCalls).toHaveLength(4);
  });
});
