import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, currentSeasonForOrg, householdForUser } from "@service-projects/database";
import { t } from "@/copy";
import { AppTopbar } from "../../AppTopbar";
import { SignupFlow } from "./SignupFlow";

// Public, no account — SPEC.md §14.1's "Flag signup" screen: holidays ->
// address -> contact/review. Stripe Checkout is follow-up work (needs
// real test keys, none exist in this environment) — see
// docs/rounds/PHASE-1.md. Submitting here creates a real
// Household/Subscription, left PENDING_PAYMENT rather than ACTIVE.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const season = org ? await currentSeasonForOrg(org.id) : null;
  const linkedHousehold =
    session?.user?.id && org ? await householdForUser(session.user.id, org.id) : null;

  if (!org || !season || season.events.length === 0) {
    return (
      <>
        <AppTopbar section={t("signup.stepper.holidays")} />
        <main className="signup-notFound">
          <h1>{t("signup.notFound.title")}</h1>
          <p>{t("signup.notFound.body")}</p>
        </main>
      </>
    );
  }

  const holidays = season.events.map((ev) => ({
    id: ev.id,
    key: ev.slug.replace(`-${season.year}`, ""),
    name: ev.name.replace(` ${season.year} — Flag Set-Out`, ""),
    date: ev.serviceStartsAt.toISOString(),
    priceCents: season.pricingMode === "per_holiday" ? season.priceCents : 0,
    mostPopular: ev.slug.startsWith("pioneer_day"),
  }));

  // Just the signup — no side panel repeating the holiday list the
  // stepper's own first step already shows. The stepper card itself
  // widens on larger viewports (see .signup-shell in globals.css)
  // instead of sharing the screen with a second copy of the same
  // information.
  return (
    <>
      <AppTopbar section={t("signup.stepper.holidays")} />
      <div className="signup-page">
        <SignupFlow
          orgId={org.id}
          seasonId={season.id}
          holidays={holidays}
          signedIn={!!session?.user}
          userId={session?.user?.id}
          initialHousehold={
            linkedHousehold
              ? {
                  contactName: linkedHousehold.contactName,
                  contactEmail: linkedHousehold.contactEmail,
                  contactPhone: linkedHousehold.contactPhone,
                  placementNote: linkedHousehold.placementNote,
                  accessNotes: linkedHousehold.accessNotes,
                  addressInput: linkedHousehold.addressInput,
                  lat: linkedHousehold.lat,
                  lng: linkedHousehold.lng,
                }
              : null
          }
        />
      </div>
    </>
  );
}
