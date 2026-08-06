import { NextResponse } from "next/server";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@service-projects/core-auth";
import { prisma } from "@service-projects/database";

// Plain API route rather than a server action: the client needs the
// created account's existence confirmed *before* it calls next-auth's
// client-side signIn("credentials", ...), which a server action can't
// trigger itself.
//
// Doubles as a sign-in check: the /register page is also where a
// returning user can just re-enter their email + password. If the email
// already has a password set, this verifies it instead of erroring, so
// the client's follow-up signIn("credentials", ...) call succeeds the
// same way either way — same page, same form, no separate login screen.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.passwordHash) {
    const valid = await verifyPassword(password, existing.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "That email already has an account, and this password doesn't match it." },
        { status: 401 }
      );
    }
    // Correct password for an existing account — nothing to create,
    // let the client sign in.
    return NextResponse.json({ ok: true });
  }

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  // If an admin already pre-created this email with a role (see
  // /admin/users) or it exists from a prior OAuth sign-in with no
  // password yet, attach the password to that same row instead of
  // creating a duplicate. `name` only sets on create — an existing
  // account's name (if any) isn't overwritten by a later password-set.
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name },
  });

  return NextResponse.json({ ok: true });
}
