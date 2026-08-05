import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@service-projects/database";
import { verifyPassword } from "./password";

const providers: NextAuthOptions["providers"] = [];

// Only registered when configured, so an app/environment that hasn't set
// these env vars yet doesn't ship a broken "Sign in with Google" button —
// SPEC.md Phase 0 needs this working, but a dev environment without the
// keys should still boot.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Lets an OWNER/ADMIN pre-create a User row for someone's email
      // (see apps/rounds/.../admin/users) and have that person's first
      // Google sign-in attach to it, instead of NextAuth creating a
      // second, unlinked PREVIEWER account for the same address. Safe
      // here because Google verifies the email it hands back.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      // Same reasoning as Google above — Microsoft verifies the email it
      // returns, so linking to a pre-created User row by email is safe.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Email + password. authorize() does its own lookup/verification rather
// than going through the PrismaAdapter — that's the standard pattern for
// mixing Credentials with an adapter-backed OAuth setup under the "jwt"
// session strategy.
providers.push(
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.trim().toLowerCase() },
      });
      // No account, or an OAuth-only account with no password set.
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(credentials.password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.name };
    },
  })
);

if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
  providers.push(
    EmailProvider({
      from: process.env.EMAIL_FROM,
      // SPEC.md §3.2 calls for Resend as the transport. NextAuth's
      // EmailProvider defaults to nodemailer/SMTP; overriding
      // sendVerificationRequest to call Resend's HTTP API directly avoids
      // adding the `resend` SDK (and SMTP credentials to manage) for what
      // is a single POST request.
      async sendVerificationRequest({ identifier, url, provider }) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: identifier,
            subject: "Your sign-in link",
            html: `<p><a href="${url}">Sign in</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
          }),
        });
        if (!res.ok) {
          throw new Error(`Resend error ${res.status}: ${await res.text()}`);
        }
      },
    })
  );
}

// Shared NextAuth config every app imports so login/session/role checks
// behave identically across all projects in this monorepo.
export const authOptions: NextAuthOptions = {
  // PrismaAdapter is required for EmailProvider (it stores verification
  // tokens in the DB regardless of session strategy) and for linking
  // Google accounts to a User row. No Session model exists in the schema
  // — under the "jwt" session strategy NextAuth never calls the
  // adapter's session methods, so it's safe to omit.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        session.user.id = token.sub;
        session.user.role = dbUser?.role ?? "PREVIEWER";
      }
      return session;
    },
  },
};
