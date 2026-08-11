import type { Prisma } from "@prisma/client";
import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";
import {
  normalizeAdminDashboardLayout,
  normalizeAdminDashboard,
  normalizePublicFormLayout,
  normalizePublicForm,
  type ScreenLayout,
} from "../layoutBlocks";

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

export async function organizationById(orgId: string) {
  return prisma.organization.findFirst({ where: { id: orgId, deletedAt: null } });
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

/**
 * Shape of the free-form `settings` JSON column that's actually read by
 * app code (the column also holds feature flags / stripeAccountId this
 * type doesn't model yet). `emailFrom` lets each org send its own emails
 * ("From: Salt Lake Flag Program <flags@saltlakeflags.org>") instead of
 * every org on this deployment sharing one hardcoded EMAIL_FROM env var
 * — important once more than one org's events are live at once, each
 * with a different point of contact. The address still has to be a
 * sender Resend will actually deliver as (a verified domain, or that
 * domain's catch-all) — this only controls what a send *asks* for, not
 * whether Resend accepts it.
 */
export interface OrganizationSettings {
  emailFrom?: string | null;
  // SPEC.md §11.3's admin-dashboard layout -- org-scoped (see
  // layoutBlocks.ts's admin-dashboard section for why), stored here
  // rather than on Event since there's no single event in context for
  // an admin's home screen.
  layoutBlocks?: { admin_dashboard?: unknown; public_form?: unknown };
}

export function organizationSettings(org: { settings: unknown }): OrganizationSettings {
  return (org.settings ?? {}) as OrganizationSettings;
}

export async function updateOrganization(
  orgId: string,
  input: { name?: string; emailFrom?: string | null }
): Promise<UpdateOrganizationResult> {
  const data: { name?: string; settings?: Prisma.InputJsonValue } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.emailFrom !== undefined) {
    const existing = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    data.settings = {
      ...organizationSettings(existing ?? { settings: {} }),
      emailFrom: input.emailFrom || null,
    } as Prisma.InputJsonValue;
  }
  const result = await prisma.organization.updateMany({ where: { id: orgId, deletedAt: null }, data });
  if (result.count === 0) return { ok: false, error: "Organization not found." };
  return { ok: true };
}

export async function adminDashboardLayoutForOrg(orgId: string): Promise<ScreenLayout> {
  const org = await organizationById(orgId);
  return normalizeAdminDashboardLayout(org ? organizationSettings(org).layoutBlocks : null);
}

export async function updateAdminDashboardLayout(
  session: SessionLike | null | undefined,
  orgId: string,
  layout: ScreenLayout
): Promise<UpdateOrganizationResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const existing = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const settings = organizationSettings(existing ?? { settings: {} });
  const data = {
    ...settings,
    layoutBlocks: { ...settings.layoutBlocks, admin_dashboard: normalizeAdminDashboard(layout) },
  } as unknown as Prisma.InputJsonValue;

  const result = await prisma.organization.updateMany({ where: { id: orgId, deletedAt: null }, data: { settings: data } });
  if (result.count === 0) return { ok: false, error: "Organization not found." };
  return { ok: true };
}

export async function publicFormLayoutForOrg(orgId: string): Promise<ScreenLayout> {
  const org = await organizationById(orgId);
  return normalizePublicFormLayout(org ? organizationSettings(org).layoutBlocks : null);
}

export async function updatePublicFormLayout(
  session: SessionLike | null | undefined,
  orgId: string,
  layout: ScreenLayout
): Promise<UpdateOrganizationResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const existing = await prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
  const settings = organizationSettings(existing ?? { settings: {} });
  const data = {
    ...settings,
    layoutBlocks: { ...settings.layoutBlocks, public_form: normalizePublicForm(layout) },
  } as unknown as Prisma.InputJsonValue;

  const result = await prisma.organization.updateMany({ where: { id: orgId, deletedAt: null }, data: { settings: data } });
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
