import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

// SPEC.md §11.1's "org override" layer -- gated OWNER/ADMIN the same
// way branding/layout edits are (packages/core-auth's copy.edit
// capability). Reading overrides is intentionally not staff-gated
// (copyOverridesForOrg): every visitor's rendered page needs these,
// same reasoning as openEventsForSignup being public.
export async function copyOverridesForOrg(orgId: string): Promise<Record<string, string>> {
  const rows = await prisma.uiCopyOverride.findMany({ where: { orgId } });
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export interface CopyOverrideActionResult {
  ok: boolean;
  error?: string;
}

// An empty/blank value resets the key back to the code default rather
// than storing an empty-string override -- there's no real use case
// for "override this to blank" and it avoids "why is this text gone"
// support questions.
export async function setCopyOverride(
  session: SessionLike | null | undefined,
  orgId: string,
  key: string,
  value: string
): Promise<CopyOverrideActionResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, error: "Forbidden" };
  const trimmedKey = key.trim();
  if (!trimmedKey) return { ok: false, error: "Key is required." };

  if (!value.trim()) {
    await prisma.uiCopyOverride.deleteMany({ where: { orgId, key: trimmedKey } });
    return { ok: true };
  }

  await prisma.uiCopyOverride.upsert({
    where: { orgId_key: { orgId, key: trimmedKey } },
    create: { orgId, key: trimmedKey, value, updatedBy: session?.user?.id ?? null },
    update: { value, updatedBy: session?.user?.id ?? null },
  });
  return { ok: true };
}
