import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaMock } from "./mockPrisma";

vi.mock("../../client", async () => {
  const { createPrismaMock } = await import("./mockPrisma");
  return { prisma: createPrismaMock() };
});

const { prisma } = await import("../../client");
const prismaMock = prisma as unknown as PrismaMock;

const { updateOrganization, organizationSettings, updateAdminDashboardLayout, adminDashboardLayoutForOrg } =
  await import("../organizations");
const { DEFAULT_ADMIN_DASHBOARD_LAYOUT, normalizeAdminDashboard } = await import("../../layoutBlocks");

const OWNER_SESSION = { user: { id: "u1", role: "OWNER" as const } };
const VOLUNTEER_SESSION = { user: { id: "u2", role: "VOLUNTEER" as const } };

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

describe("adminDashboardLayoutForOrg", () => {
  it("returns the default layout when the org has no saved layout", async () => {
    prismaMock.organization.findFirst.mockResolvedValueOnce({ id: "org-1", settings: null });
    expect(await adminDashboardLayoutForOrg("org-1")).toEqual(normalizeAdminDashboard(null));
  });

  it("returns the default layout when the org doesn't exist", async () => {
    prismaMock.organization.findFirst.mockResolvedValueOnce(null);
    expect(await adminDashboardLayoutForOrg("org-missing")).toEqual(normalizeAdminDashboard(null));
  });
});

describe("updateAdminDashboardLayout", () => {
  it("rejects a non-staff session", async () => {
    const result = await updateAdminDashboardLayout(VOLUNTEER_SESSION, "org-1", DEFAULT_ADMIN_DASHBOARD_LAYOUT);
    expect(result).toEqual({ ok: false, error: "Forbidden" });
    expect(prismaMock.organization.updateMany).not.toHaveBeenCalled();
  });

  it("merges the admin-dashboard layout into settings without clobbering other keys", async () => {
    prismaMock.organization.findUnique.mockResolvedValueOnce({ settings: { emailFrom: "flags@org.org" } });
    const result = await updateAdminDashboardLayout(OWNER_SESSION, "org-1", DEFAULT_ADMIN_DASHBOARD_LAYOUT);
    expect(result).toEqual({ ok: true });
    expect(prismaMock.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", deletedAt: null },
      data: {
        settings: {
          emailFrom: "flags@org.org",
          layoutBlocks: { admin_dashboard: normalizeAdminDashboard(DEFAULT_ADMIN_DASHBOARD_LAYOUT) },
        },
      },
    });
  });

  it("reports not-found when nothing matches", async () => {
    prismaMock.organization.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await updateAdminDashboardLayout(OWNER_SESSION, "org-missing", DEFAULT_ADMIN_DASHBOARD_LAYOUT);
    expect(result).toEqual({ ok: false, error: "Organization not found." });
  });
});
