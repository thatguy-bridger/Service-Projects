import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, linkHouseholdToUser } from "@service-projects/database";

// Called right after a household's own "create an account" flow on the
// signup confirmation screen (RegisterForm.tsx) finishes signIn(), so
// this request carries the fresh session cookie. Links the household
// they just submitted anonymously to the account they just created —
// no staff role required, since a session can only ever link a
// household to *itself*, and the household id came from that same
// household's own just-completed submission.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const householdId = typeof body?.householdId === "string" ? body.householdId : "";
  if (!householdId) {
    return NextResponse.json({ error: "householdId is required." }, { status: 400 });
  }

  const org = await defaultOrganization();
  if (!org) {
    return NextResponse.json({ error: "No organization set up yet." }, { status: 400 });
  }

  const result = await linkHouseholdToUser(householdId, session.user.id, org.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not link household." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
