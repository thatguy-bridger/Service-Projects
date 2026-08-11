"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  createCategory,
  renameCategory,
  setCategoryPrice,
  deleteCategories,
  publishCategory,
  unpublishCategory,
  type CategoryActionResult,
} from "@service-projects/database";

export async function createCategoryAction(name: string): Promise<CategoryActionResult> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await createCategory(session, org.id, name);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/events");
  return result;
}

// DataTable's inline row editor always sends every editable column's
// current value together (see DataTable.tsx's saveEdit/startEdit), not
// just the one the admin actually changed -- so this has to apply each
// field present in the patch, in order, rather than assuming only one
// arrived. `published` (the Signup status column) is handled here too,
// alongside name/price, for the same reason: it always arrives bundled
// with whatever else is in the row.
export async function saveCategoryRowAction(
  id: string,
  patch: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };

  let result: { ok: boolean; error?: string } = { ok: true };

  if (patch.name !== undefined) {
    result = await renameCategory(session, org.id, id, patch.name);
    if (!result.ok) {
      revalidatePath("/admin/categories");
      revalidatePath("/admin/events");
      return result;
    }
  }

  if (patch.priceCents !== undefined) {
    const priceCents = patch.priceCents.trim() === "" ? null : Math.round(Number(patch.priceCents) * 100);
    result = await setCategoryPrice(session, org.id, id, priceCents);
    if (!result.ok) {
      revalidatePath("/admin/categories");
      revalidatePath("/admin/events");
      return result;
    }
  }

  if (patch.published !== undefined) {
    result =
      patch.published === "Published"
        ? await publishCategory(session, org.id, id)
        : await unpublishCategory(session, org.id, id);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/events");
  revalidatePath("/signup");
  return result;
}

export async function deleteCategoriesAction(ids: string[]): Promise<{ deleted: number }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { deleted: 0 };
  const result = await deleteCategories(session, org.id, ids);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/events");
  return result;
}

