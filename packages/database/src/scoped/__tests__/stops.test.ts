import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { generateStopsFromSubscriptions } = await import("../stops");

beforeEach(() => {
  vi.clearAllMocks();
});

const OWNER = { user: { id: "u-owner", role: "OWNER" as const } };
const VOLUNTEER = { user: { id: "u-vol", role: "VOLUNTEER" as const } };

function subscriptionEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "se-1",
    stopId: null,
    subscription: {
      household: {
        id: "hh-1",
        deletedAt: null,
        needsReview: false,
        lat: 40.5,
        lng: -111.8,
        addressInput: "123 Main St",
        placementNote: null,
        accessNotes: null,
      },
    },
    ...overrides,
  };
}

describe("generateStopsFromSubscriptions", () => {
  it("blocks a non-staff caller", async () => {
    const result = await generateStopsFromSubscriptions(VOLUNTEER, "event-1");
    expect(result.error).toBe("Forbidden");
    expect(prismaMock.subscriptionEvent.findMany).not.toHaveBeenCalled();
  });

  it("creates a stop for a household not yet reviewed as a duplicate/needs-review", async () => {
    prismaMock.subscriptionEvent.findMany.mockResolvedValueOnce([subscriptionEvent()]);
    const result = await generateStopsFromSubscriptions(OWNER, "event-1");
    expect(result).toEqual({ created: 1, alreadyExisted: 0 });
    expect(prismaMock.stop.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: "event-1", householdId: "hh-1", source: "SUBSCRIPTION" }),
    });
    expect(prismaMock.subscriptionEvent.update).toHaveBeenCalledWith({
      where: { id: "se-1" },
      data: { stopId: "stop-mock" },
    });
  });

  it("skips a household still needing review — never routes to an unverified address", async () => {
    prismaMock.subscriptionEvent.findMany.mockResolvedValueOnce([
      subscriptionEvent({ subscription: { household: { ...subscriptionEvent().subscription.household, needsReview: true } } }),
    ]);
    const result = await generateStopsFromSubscriptions(OWNER, "event-1");
    expect(result).toEqual({ created: 0, alreadyExisted: 0 });
    expect(prismaMock.stop.create).not.toHaveBeenCalled();
  });

  it("is idempotent — a SubscriptionEvent that already has a stopId is counted, not re-created", async () => {
    prismaMock.subscriptionEvent.findMany.mockResolvedValueOnce([subscriptionEvent({ stopId: "existing-stop" })]);
    const result = await generateStopsFromSubscriptions(OWNER, "event-1");
    expect(result).toEqual({ created: 0, alreadyExisted: 1 });
    expect(prismaMock.stop.create).not.toHaveBeenCalled();
  });

  it("is idempotent even when a prior run created the Stop but failed before linking it back", async () => {
    prismaMock.subscriptionEvent.findMany.mockResolvedValueOnce([subscriptionEvent()]);
    prismaMock.stop.findFirst.mockResolvedValueOnce({ id: "orphaned-stop" });
    const result = await generateStopsFromSubscriptions(OWNER, "event-1");
    expect(result).toEqual({ created: 0, alreadyExisted: 1 });
    expect(prismaMock.stop.create).not.toHaveBeenCalled();
    expect(prismaMock.subscriptionEvent.update).toHaveBeenCalledWith({
      where: { id: "se-1" },
      data: { stopId: "orphaned-stop" },
    });
  });
});
