import { defaultOrganization, currentSeasonForOrg } from "@service-projects/database";
import { t } from "@/copy";
import { formatCentsShort, formatHolidayDate } from "@/lib/format";
import { AppTopbar } from "../../AppTopbar";
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

  // Wide viewports get the app's normal chrome plus a summary side panel
  // instead of a lone centered card floating in empty gutters — the
  // stepper itself stays exactly as narrow/mobile-first as before, since
  // that's still correct for the phone-in-hand case it's designed for.
  return (
    <>
      <AppTopbar section={t("signup.stepper.holidays")} />
      <div className="signup-page">
        <aside className="signup-side">
          <h2>{season.name}</h2>
          <p className="signup-sideBody">{t("signup.side.body", { org: org.name })}</p>
          <ul className="signup-sideList">
            {holidays.map((h) => (
              <li key={h.id}>
                <span>{h.name}</span>
                <span className="signup-sideDate">{formatHolidayDate(new Date(h.date))}</span>
                <span className="signup-sidePrice">{formatCentsShort(h.priceCents)}</span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="signup-main">
          <SignupFlow orgId={org.id} orgName={org.name} seasonId={season.id} holidays={holidays} />
        </div>
      </div>
    </>
  );
}
