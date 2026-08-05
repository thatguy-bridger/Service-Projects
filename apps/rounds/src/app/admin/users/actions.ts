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

export interface UpdateUserResult {
  ok: boolean;
  error?: string;
}

export async function updateUserAction(
  userId: string,
  _prevState: UpdateUserResult,
  formData: FormData
): Promise<UpdateUserResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role." };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found." };
  if (role === "OWNER" && session?.user.role !== "OWNER") {
    return { ok: false, error: "Only an Owner can grant the Owner role." };
  }
  if (target.role === "OWNER" && role !== "OWNER" && session?.user.role !== "OWNER") {
    return { ok: false, error: "Only an Owner can change an Owner's role." };
  }
  if (!can(session?.user.role, "users.manageRoles")) {
    return { ok: false, error: "Forbidden" };
  }

  await prisma.user.update({ where: { id: userId }, data: { name: name || null, role } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export interface DeleteUsersResult {
  deleted: number;
  errors: { email: string; reason: string }[];
}

// User has no deletedAt (unlike Household/Event) and Membership/
// Subscription rows reference it without an onDelete: Cascade, so a
// hard delete can genuinely fail — caught per-row here and reported,
// same honest pattern as CSV import, rather than one failure aborting
// the whole batch or crashing the request.
export async function deleteUsers(_prevState: DeleteUsersResult, formData: FormData): Promise<DeleteUsersResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const ids = formData.getAll("userIds").map(String);
  const errors: DeleteUsersResult["errors"] = [];
  let deleted = 0;

  for (const id of ids) {
    if (id === session?.user.id) {
      errors.push({ email: id, reason: "Can't delete your own account." });
      continue;
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) continue;
    if (target.role === "OWNER" && session?.user.role !== "OWNER") {
      errors.push({ email: target.email, reason: "Only an Owner can delete an Owner account." });
      continue;
    }
    try {
      await prisma.user.delete({ where: { id } });
      deleted++;
    } catch {
      errors.push({ email: target.email, reason: "Still has memberships or other records attached." });
    }
  }

  revalidatePath("/admin/users");
  return { deleted, errors };
}
