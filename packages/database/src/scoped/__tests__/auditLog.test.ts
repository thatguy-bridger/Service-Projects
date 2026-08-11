import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { recordAuditEvent } = await import("../auditLog");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.membership.findFirst.mockResolvedValue(null);
});

const OWNER = { user: { id: "u-owner", role: "OWNER" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

describe("recordAuditEvent", () => {
  it("does nothing for a non-staff caller", async () => {
    await recordAuditEvent(VOLUNTEER, {
      orgId: "org-1",
      action: "households.exported",
      entity: "Event",
      entityId: "event-1",
    });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("does nothing for a signed-out caller", async () => {
    await recordAuditEvent(null, {
      orgId: "org-1",
      action: "households.exported",
      entity: "Event",
      entityId: "event-1",
    });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("writes a row with the actor, action, and ipHash for a staff caller", async () => {
    await recordAuditEvent(OWNER, {
      orgId: "org-1",
      action: "households.exported",
      entity: "Event",
      entityId: "event-1",
      after: { count: 42 },
      ipHash: "abc123",
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        orgId: "org-1",
        actorId: "u-owner",
        action: "households.exported",
        entity: "Event",
        entityId: "event-1",
        after: { count: 42 },
        ipHash: "abc123",
      },
    });
  });
});
