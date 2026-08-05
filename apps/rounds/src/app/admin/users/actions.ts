"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole, can } from "@service-projects/core-auth";
import { prisma, type Role } from "@service-projects/database";
import { ROLES } from "@service-projects/core-auth";

// User isn't one of the models the ESLint scoped-access rule bans
// (SPEC.md §6 covers stop/signup/household/visit), so a direct
// prisma.user call here is the correct, established pattern.
export async function setUserRole(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;

  if (!email || !ROLES.includes(role)) {
    throw new Error("Invalid email or role");
  }

  // Only an Owner can grant the Owner role — an Admin managing users
  // can't hand out the one role above their own. can() drives the same
  // check on the capability card, so this can't drift from what the UI
  // claims is allowed (permissions.ts's conditional note on users.manageRoles).
  if (role === "OWNER" && session?.user.role !== "OWNER") {
    throw new Error("Only an Owner can grant the Owner role");
  }
  if (!can(session?.user.role, "users.manageRoles")) {
    throw new Error("Forbidden");
  }

  await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, role },
  });

  revalidatePath("/admin/users");
}
