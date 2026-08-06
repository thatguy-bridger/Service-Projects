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

  it("fails on a revoked key", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      orgId: "org-1",
      eventId: null,
      grantsRole: "VOLUNTEER",
      maxUses: 1,
      useCount: 0,
      expiresAt: null,
      revokedAt: new Date(),
    });
    const result = await redeemInviteKey(VOLUNTEER, "raw-code");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("fails on an expired key", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      orgId: "org-1",
      eventId: null,
      grantsRole: "VOLUNTEER",
      maxUses: 1,
      useCount: 0,
      expiresAt: new Date("2000-01-01"),
      revokedAt: null,
    });
    const result = await redeemInviteKey(VOLUNTEER, "raw-code");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("fails once maxUses is reached", async () => {
    prismaMock.inviteKey.findUnique.mockResolvedValueOnce({
      id: "key-1",
      orgId: "org-1",
      eventId: null,
      grantsRole: "VOLUNTEER",
      maxUses: 1,
      useCount: 1,
      expiresAt: null,
      revokedAt: null,
    });
    const result = await redeemInviteKey(VOLUNTEER, "raw-code");
    expect(result.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
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
});
