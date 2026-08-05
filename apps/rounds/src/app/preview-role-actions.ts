"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, ROLES } from "@service-projects/core-auth";
import { PREVIEW_COOKIE } from "@/lib/previewRole";

// Gated against the *real* session role, never the preview itself —
// this is the one place that decides who's allowed to preview at all.
export async function setPreviewRole(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  const realRole = session?.user?.role;
  if (realRole !== "OWNER" && realRole !== "ADMIN") {
    throw new Error("Forbidden");
  }

  const role = String(formData.get("role") ?? "");
  const store = cookies();

  if (!role || role === "REAL") {
    store.delete(PREVIEW_COOKIE);
  } else if ((ROLES as string[]).includes(role)) {
    store.set(PREVIEW_COOKIE, role, { path: "/", maxAge: 60 * 60 * 8 });
  }

  revalidatePath("/");
  revalidatePath("/admin/users");
}
