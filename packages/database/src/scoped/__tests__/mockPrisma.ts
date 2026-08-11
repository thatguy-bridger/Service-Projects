import { vi } from "vitest";

// A hand-built stand-in for the Prisma client, not a real database
// connection — this sandbox can't reach Postgres (only outbound HTTPS
// works here), so these tests exercise the *authorization logic* in
// each scoped helper (who gets which `where` clause, who gets turned
// away before any query runs) rather than real query results. That's
// exactly the surface SPEC.md §6 asks to be tested: "a volunteer
// session cannot read an unassigned stop, a previewer reads nothing, a
// coordinator cannot read another org's data" — all of that is decided
// by the `where` clause these mocks let us inspect, not by what
// Postgres would actually return for it.
export function createPrismaMock() {
  return {
    household: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "household-mock" }),
      update: vi.fn(),
    },
    event: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "event-mock" }),
      update: vi.fn(),
    },
    membership: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
    subscriptionEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn(),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "category-mock" }),
      aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
    },
    $transaction: vi.fn().mockResolvedValue([]),
    subscription: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    stop: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "stop-mock" }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    organization: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    route: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
    territory: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ id: "territory-mock" }),
      create: vi.fn().mockResolvedValue({ id: "territory-mock" }),
    },
    uiCopyOverride: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({ id: "copy-override-mock" }),
    },
    addressPoint: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    routeAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    visit: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    inviteKey: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    keyRedemption: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
