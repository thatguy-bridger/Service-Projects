import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

// Imported after the mock is wired up, so `prisma` here *is* the mock —
// the same instance the module under test (membership.ts) imports.
const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { isStaff, resolveMembership, requireOrgAccess } = await import("../membership");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isStaff", () => {
  it("is true for OWNER, ADMIN, COORDINATOR", () => {
    expect(isStaff("OWNER")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
    expect(isStaff("COORDINATOR")).toBe(true);
  });

  it("is false for VOLUNTEER, PREVIEWER, and no role", () => {
    expect(isStaff("VOLUNTEER")).toBe(false);
    expect(isStaff("PREVIEWER")).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});

describe("resolveMembership", () => {
  it("returns null with no signed-in user", async () => {
    expect(await resolveMembership(null)).toBeNull();
    expect(await resolveMembership({ user: null })).toBeNull();
  });

  it("short-circuits OWNER/ADMIN org-wide without a membership lookup", async () => {
    const owner = { user: { id: "u1", role: "OWNER" as const } };
    const result = await resolveMembership(owner, "event-1");
    expect(result).toEqual({ role: "OWNER" });
    // The whole point of the org-wide shortcut: no DB round trip needed
    // to know an Owner has access to a specific event.
    expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
  });

  it("returns the top-level role directly when no eventId is given", async () => {
    const volunteer = { user: { id: "u2", role: "VOLUNTEER" as const } };
    const result = await resolveMembership(volunteer);
    expect(result).toEqual({ role: "VOLUNTEER" });
    expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
  });

  it("resolves an event-scoped membership role over the top-level role", async () => {
    // A user whose top-level role is VOLUNTEER but who has an active
    // COORDINATOR membership on this one event — SPEC.md §3.3's whole
    // reason event-scoped Membership rows exist.
    prismaMock.membership.findFirst.mockResolvedValueOnce({ role: "COORDINATOR" });
    const session = { user: { id: "u3", role: "VOLUNTEER" as const } };
    const result = await resolveMembership(session, "event-42");
    expect(result).toEqual({ role: "COORDINATOR" });
    expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
      where: { userId: "u3", eventId: "event-42", status: "active" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("falls back to the top-level role when no membership row exists for that event", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    const session = { user: { id: "u4", role: "PREVIEWER" as const } };
    const result = await resolveMembership(session, "event-99");
    expect(result).toEqual({ role: "PREVIEWER" });
  });
});

describe("requireOrgAccess", () => {
  it("throws for an unauthenticated session", async () => {
    await expect(requireOrgAccess(null, "org-1")).rejects.toThrow("Forbidden");
  });

  it("allows OWNER/ADMIN without a membership row", async () => {
    const admin = { user: { id: "u1", role: "ADMIN" as const } };
    await expect(requireOrgAccess(admin, "org-1")).resolves.toBeUndefined();
    expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
  });

  it("throws for a non-staff user with no membership in that org", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce(null);
    const volunteer = { user: { id: "u5", role: "VOLUNTEER" as const } };
    await expect(requireOrgAccess(volunteer, "org-1")).rejects.toThrow("Forbidden");
  });

  it("allows a non-staff user with an active membership in that org", async () => {
    prismaMock.membership.findFirst.mockResolvedValueOnce({ id: "m1" });
    const volunteer = { user: { id: "u6", role: "VOLUNTEER" as const } };
    await expect(requireOrgAccess(volunteer, "org-1")).resolves.toBeUndefined();
  });
});
