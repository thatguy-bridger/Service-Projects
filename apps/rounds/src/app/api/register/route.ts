import { NextResponse } from "next/server";
import { hashPassword, isPasswordStrongEnough } from "@service-projects/core-auth";
import { prisma } from "@service-projects/database";

// Plain API route rather than a server action: the client needs the
// created account's existence confirmed *before* it calls next-auth's
// client-side signIn("credentials", ...), which a server action can't
// trigger itself.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // If an admin already pre-created this email with a role (see
  // /admin/users) or it exists from a prior OAuth sign-in, attach the
  // password to that same row instead of creating a duplicate.
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  return NextResponse.json({ ok: true });
}
