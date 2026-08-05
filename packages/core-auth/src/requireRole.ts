import type { Session } from "next-auth";

export type Role = "ADMIN" | "USER";

// Guard for server actions / route handlers: throws if the session lacks the role.
export function requireRole(session: Session | null, role: Role) {
  if (!session?.user || session.user.role !== role) {
    throw new Error("Forbidden");
  }
}
