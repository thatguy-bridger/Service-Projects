import { prisma } from "../client";

/**
 * This app's real-world scope is one organization (SPEC.md §22.1's
 * locked decisions — a single Salt Lake County volunteer org), and there
 * is no subdomain/tenant-resolution mechanism yet to pick an org from a
 * request. Every public page resolves "the" org through this until
 * multi-tenant routing is actually needed — same simplification already
 * documented for `resolveMembership`'s OWNER/ADMIN shortcut in
 * docs/rounds/PHASE-0.md.
 */
export async function defaultOrganization() {
  return prisma.organization.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
}

/**
 * Bootstraps the one organization this app's real-world scope needs
 * (see the note above) if it doesn't exist yet. Called from the admin
 * "generate this year's flag events" flow — gating who can call this is the caller's
 * job (requireRole against the real session), same convention as
 * setUserRole in apps/rounds/.../admin/users/actions.ts.
 */
export interface UpdateOrganizationResult {
  ok: boolean;
  error?: string;
}

export async function updateOrganization(
  orgId: string,
  input: { name?: string }
): Promise<UpdateOrganizationResult> {
  const result = await prisma.organization.updateMany({ where: { id: orgId, deletedAt: null }, data: input });
  if (result.count === 0) return { ok: false, error: "Organization not found." };
  return { ok: true };
}

export async function getOrCreateDefaultOrganization(name: string) {
  const existing = await defaultOrganization();
  if (existing) return existing;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return prisma.organization.create({ data: { name, slug } });
}
