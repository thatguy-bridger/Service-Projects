import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { ROLES, type Role } from "@service-projects/core-auth";

export const PREVIEW_COOKIE = "rounds_preview_role";

// UI-only. This never gates a mutation and never grants a real
// permission — only OWNER/ADMIN can set the cookie in the first place
// (enforced against the real session in setPreviewRole), and every
// server action still checks the *real* session role independently.
// This exists purely so an Owner/Admin can see what a lower role's
// screens look like without a second account.
export function getEffectiveRole(session: Session | null): Role | null {
  const realRole = session?.user?.role ?? null;
  if (!realRole || (realRole !== "OWNER" && realRole !== "ADMIN")) {
    return realRole;
  }
  const previewed = cookies().get(PREVIEW_COOKIE)?.value;
  if (previewed && (ROLES as string[]).includes(previewed)) {
    return previewed as Role;
  }
  return realRole;
}
