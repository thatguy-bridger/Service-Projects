"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { prisma } from "@service-projects/database";

// User isn't a model the ESLint scoped-access rule bans (SPEC.md §6
// covers stop/signup/household/visit only), so a direct prisma.user
// call here is the same established pattern as setUserRole.
async function markOnboarded(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  await prisma.user.update({ where: { id: session.user.id }, data: { onboardedAt: new Date() } });
  return session.user.id;
}

export async function chooseCustomerIntent(): Promise<void> {
  await markOnboarded();
  redirect("/signup");
}

// No invite-key redemption exists yet (SPEC.md's Phase 5) — a real
// Volunteer/Coordinator role can only be granted by an Owner/Admin via
// /admin/users today. This just records the interest and sends them
// home; it deliberately doesn't pretend to grant a role or redirect
// somewhere that doesn't exist yet.
export async function chooseVolunteerIntent(): Promise<void> {
  await markOnboarded();
  redirect("/?welcomed=volunteer");
}
