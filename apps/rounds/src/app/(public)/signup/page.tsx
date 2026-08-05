import { defaultOrganization, currentSeasonForOrg } from "@service-projects/database";
import { t } from "@/copy";
import { SignupFlow } from "./SignupFlow";

// Public, no account — SPEC.md §14.1's "Flag signup" screen: holidays ->
// address -> contact/review. Stripe Checkout is follow-up work (needs
// real test keys, none exist in this environment) — see
// docs/rounds/PHASE-1.md. Submitting here creates a real
// Household/Subscription, left PENDING_PAYMENT rather than ACTIVE.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const org = await defaultOrganization();
  const season = org ? await currentSeasonForOrg(org.id) : null;

  if (!org || !season || season.events.length === 0) {
    return (
      <main className="signup-notFound">
        <h1>{t("signup.notFound.title")}</h1>
        <p>{t("signup.notFound.body")}</p>
      </main>
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

  return <SignupFlow orgId={org.id} orgName={org.name} seasonId={season.id} holidays={holidays} />;
}
