import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { updateOrganization, organizationSettings } = await import("../organizations");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("organizationSettings", () => {
  it("reads emailFrom out of the settings JSON blob, defaulting to an empty object", () => {
    expect(organizationSettings({ settings: { emailFrom: "Flags <flags@org.org>" } })).toEqual({
      emailFrom: "Flags <flags@org.org>",
    });
    expect(organizationSettings({ settings: null })).toEqual({});
  });
});

describe("updateOrganization", () => {
  it("updates just the name when emailFrom isn't given, without touching settings", async () => {
    await updateOrganization("org-1", { name: "New name" });
    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", deletedAt: null },
      data: { name: "New name" },
    });
  });

  it("merges emailFrom into existing settings rather than clobbering other keys", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({ settings: { stripeAccountId: "acct_1" } });
    await updateOrganization("org-1", { emailFrom: "Flags <flags@org.org>" });
    expect(prismaMock.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", deletedAt: null },
      data: { settings: { stripeAccountId: "acct_1", emailFrom: "Flags <flags@org.org>" } },
    });
  });

  it("clears emailFrom back to null", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({ settings: { emailFrom: "old@org.org" } });
    await updateOrganization("org-1", { emailFrom: null });
    expect(prismaMock.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", deletedAt: null },
      data: { settings: { emailFrom: null } },
    });
  });

  it("reports not-found when nothing matches", async () => {
    prismaMock.organization.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await updateOrganization("org-missing", { name: "x" });
    expect(result).toEqual({ ok: false, error: "Organization not found." });
  });
});
