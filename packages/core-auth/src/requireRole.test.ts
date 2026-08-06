import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveMembershipMock = vi.hoisted(() => vi.fn());

vi.mock("@service-projects/database", () => ({
  resolveMembership: resolveMembershipMock,
}));

const { requireRole } = await import("./requireRole");

beforeEach(() => {
  resolveMembershipMock.mockReset();
});

function session(role: string) {
  return { user: { id: "u1", role } } as unknown as Parameters<typeof requireRole>[0];
}

describe("requireRole", () => {
  it("throws for no session", async () => {
    await expect(requireRole(null, "ADMIN")).rejects.toThrow("Forbidden");
  });

  it("passes when the session's top-level role is in the allowed list", async () => {
    await expect(requireRole(session("ADMIN"), "ADMIN")).resolves.toBeUndefined();
    await expect(requireRole(session("OWNER"), ["OWNER", "ADMIN"])).resolves.toBeUndefined();
  });

  it("throws when the top-level role isn't allowed and no eventId is given", async () => {
    await expect(requireRole(session("VOLUNTEER"), "ADMIN")).rejects.toThrow("Forbidden");
    expect(resolveMembershipMock).not.toHaveBeenCalled();
  });

  it("falls back to an event-scoped membership when eventId is given", async () => {
    // Top-level role is VOLUNTEER, but this session has a COORDINATOR
    // membership on this specific event — SPEC.md §3.3.
    resolveMembershipMock.mockResolvedValueOnce({ role: "COORDINATOR" });
    await expect(
      requireRole(session("VOLUNTEER"), ["OWNER", "ADMIN", "COORDINATOR"], { eventId: "event-1" })
    ).resolves.toBeUndefined();
    expect(resolveMembershipMock).toHaveBeenCalledWith(expect.anything(), "event-1");
  });

  it("throws when neither the top-level role nor the event membership is allowed", async () => {
    resolveMembershipMock.mockResolvedValueOnce({ role: "VOLUNTEER" });
    await expect(
      requireRole(session("VOLUNTEER"), ["OWNER", "ADMIN", "COORDINATOR"], { eventId: "event-1" })
    ).rejects.toThrow("Forbidden");
  });

  it("throws when there's no membership at all for that event", async () => {
    resolveMembershipMock.mockResolvedValueOnce(null);
    await expect(requireRole(session("VOLUNTEER"), "COORDINATOR", { eventId: "event-1" })).rejects.toThrow(
      "Forbidden"
    );
  });
});
