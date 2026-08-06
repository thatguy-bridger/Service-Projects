"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  createCategory,
  renameCategory,
  deleteCategories,
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

export async function saveCategoryRowAction(
  id: string,
  patch: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) return { ok: false, error: "No organization." };
  const result = await renameCategory(session, org.id, id, patch.name ?? "");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/events");
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
