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
