import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";

// A small generic writer for SPEC.md §20's "exports audited" (and
// anywhere else a staff-only action needs an AuditLog row without its
// own bespoke helper -- inviteKeys.ts writes its own directly since key
// issue/revoke/redeem already had a natural home there). Staff-gated
// the same way every other write in this package is; audit logging is
// a side effect of an already-authorized action, not its own
// permission surface.
export async function recordAuditEvent(
  session: SessionLike | null | undefined,
  input: {
    orgId: string;
    action: string;
    entity: string;
    entityId: string;
    after?: object;
    ipHash?: string;
  }
): Promise<void> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return;

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: session?.user?.id ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      after: input.after,
      ipHash: input.ipHash,
    },
  });
}
