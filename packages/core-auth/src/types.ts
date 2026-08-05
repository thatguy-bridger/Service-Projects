import type { DefaultSession } from "next-auth";
import type { Role } from "@service-projects/database";

// Extends NextAuth's session/user types with our role-based fields so
// `session.user.id` / `session.user.role` type-check in every app.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Null until they've picked what they're here to do at /welcome. */
      onboardedAt: Date | null;
    } & DefaultSession["user"];
  }
}
