import { describe, it, expect } from "vitest";
import { can, capabilityCard, PERMISSIONS, ROLES } from "./permissions";

describe("can", () => {
  it("is false with no role", () => {
    expect(can(null, "event.manage")).toBe(false);
    expect(can(undefined, "event.manage")).toBe(false);
  });

  it("is false for an unknown capability id", () => {
    expect(can("OWNER", "not.a.real.capability")).toBe(false);
  });

  it("matches the declared roles for a real capability", () => {
    expect(can("OWNER", "event.manage")).toBe(true);
    expect(can("ADMIN", "event.manage")).toBe(true);
    expect(can("COORDINATOR", "event.manage")).toBe(false);
    expect(can("VOLUNTEER", "event.manage")).toBe(false);
    expect(can("PREVIEWER", "event.manage")).toBe(false);
  });

  it("Owner-only capabilities exclude Admin", () => {
    expect(can("OWNER", "keys.issueAdmin")).toBe(true);
    expect(can("ADMIN", "keys.issueAdmin")).toBe(false);
  });

  it("every role can browse public events and redeem a key", () => {
    for (const role of ROLES) {
      expect(can(role, "public.browseAndRedeem")).toBe(true);
    }
  });
});

describe("capabilityCard", () => {
  it("has one entry per permission, in the same order", () => {
    const card = capabilityCard("VOLUNTEER");
    expect(card).toHaveLength(PERMISSIONS.length);
    expect(card.map((c) => c.id)).toEqual(PERMISSIONS.map((p) => p.id));
  });

  it("marks granted/not-granted correctly for a given role", () => {
    const card = capabilityCard("VOLUNTEER");
    const visitRecord = card.find((c) => c.id === "visit.record");
    const eventManage = card.find((c) => c.id === "event.manage");
    expect(visitRecord?.granted).toBe(true);
    expect(eventManage?.granted).toBe(false);
  });

  it("surfaces the conditional footnote only for the role it applies to", () => {
    const volunteerCard = capabilityCard("VOLUNTEER");
    const ownerCard = capabilityCard("OWNER");
    const volunteerEntry = volunteerCard.find((c) => c.id === "household.viewContact");
    const ownerEntry = ownerCard.find((c) => c.id === "household.viewContact");
    expect(volunteerEntry?.note).toBe("Only for fields an admin has marked visible to volunteers.");
    expect(ownerEntry?.note).toBeUndefined();
  });

  it("can never grant something requireRole would reject — same table drives both", () => {
    // The whole point of PERMISSIONS being the single source of truth
    // (SPEC.md §3.4): every capability marked granted for a role is
    // exactly the set requireRole(session, [...roles]) would also allow,
    // because both read from this same array, not two hand-kept lists.
    for (const role of ROLES) {
      const card = capabilityCard(role);
      for (const entry of card) {
        const capability = PERMISSIONS.find((p) => p.id === entry.id)!;
        expect(entry.granted).toBe(capability.roles.includes(role));
      }
    }
  });
});
