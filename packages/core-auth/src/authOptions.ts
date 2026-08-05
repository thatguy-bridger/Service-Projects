import type { NextAuthOptions } from "next-auth";
import { prisma } from "@service-projects/database";

// Shared NextAuth config every app imports so login/session/role checks
// behave identically across all projects in this monorepo.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    // Add providers (Credentials, Google, etc.) per your chosen auth flow.
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        session.user.id = token.sub;
        session.user.role = dbUser?.role ?? "USER";
      }
      return session;
    },
  },
};
