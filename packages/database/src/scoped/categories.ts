import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "category";
}

export async function categoriesForOrg(orgId: string) {
  return prisma.category.findMany({
    where: { orgId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { events: { where: { deletedAt: null } } } } },
  });
}

export interface CategoryActionResult {
  ok: boolean;
  error?: string;
  categoryId?: string;
}

export async function createCategory(
  session: SessionLike | null | undefined,
  orgId: string,
  name: string,
  priceCents?: number | null
): Promise<CategoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  const baseSlug = slugify(trimmed);
  let slug = baseSlug;
  let attempt = 1;
  // Small, bounded retry rather than a transaction -- category creation
  // is a rare, staff-only, low-contention action.
  while (await prisma.category.findFirst({ where: { orgId, slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const maxOrder = await prisma.category.aggregate({
    where: { orgId, deletedAt: null },
    _max: { sortOrder: true },
  });

  const category = await prisma.category.create({
    data: {
      orgId,
      name: trimmed,
      slug,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      priceCents: priceCents ?? null,
    },
  });
  return { ok: true, categoryId: category.id };
}

export async function renameCategory(
  session: SessionLike | null | undefined,
  orgId: string,
  categoryId: string,
  name: string
): Promise<CategoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };

  const result = await prisma.category.updateMany({
    where: { id: categoryId, orgId, deletedAt: null },
    data: { name: trimmed },
  });
  if (result.count === 0) return { ok: false, error: "Category not found." };
  return { ok: true };
}

export async function setCategoryPrice(
  session: SessionLike | null | undefined,
  orgId: string,
  categoryId: string,
  priceCents: number | null
): Promise<CategoryActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.category.updateMany({
    where: { id: categoryId, orgId, deletedAt: null },
    data: { priceCents },
  });
  if (result.count === 0) return { ok: false, error: "Category not found." };
  return { ok: true };
}

// Soft delete -- and, per explicit feedback, cascades to every Event
// still in that category too. The original design left those events
// live and just re-bucketed them as "Uncategorized" (their categoryId
// unchanged, only the category's own name/browsability hidden), on the
// theory that a category is just a label and deleting a label shouldn't
// delete what it was labeling. In practice that reads as a bug: an
// admin deleting a category (e.g. a duplicate/test batch of flag
// events) expects those events gone from signup, not silently
// reappearing uncategorized. Both updates run in one transaction so a
// category is never left half-deleted with its events still live.
export async function deleteCategories(
  session: SessionLike | null | undefined,
  orgId: string,
  categoryIds: string[]
): Promise<{ deleted: number }> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { deleted: 0 };

  const deletedAt = new Date();
  const [result] = await prisma.$transaction([
    prisma.category.updateMany({ where: { id: { in: categoryIds }, orgId }, data: { deletedAt } }),
    prisma.event.updateMany({ where: { categoryId: { in: categoryIds }, orgId, deletedAt: null }, data: { deletedAt } }),
  ]);
  return { deleted: result.count };
}

export async function setEventCategory(
  session: SessionLike | null | undefined,
  orgId: string,
  eventId: string,
  categoryId: string | null
): Promise<CategoryActionResult> {
  const membership = await resolveMembership(session, eventId);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };

  const result = await prisma.event.updateMany({
    where: { id: eventId, orgId, deletedAt: null },
    data: { categoryId },
  });
  if (result.count === 0) return { ok: false, error: "Event not found." };
  return { ok: true };
}
