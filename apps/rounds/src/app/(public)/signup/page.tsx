import { defaultOrganization, currentSeasonForOrg } from "@service-projects/database";
import { t } from "@/copy";
import { HolidayPicker } from "./HolidayPicker";

// Public, no account — SPEC.md §14.1's "Flag signup" screen, step 1
// (holiday picker) of the stepper: holidays -> address -> pay. Address
// and pay are follow-up work; see docs/rounds/PHASE-1.md.
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
    key: ev.slug.replace(`-${season.year}`, ""),
    name: ev.name.replace(` ${season.year} — Flag Set-Out`, ""),
    date: ev.serviceStartsAt.toISOString(),
    priceCents: season.pricingMode === "per_holiday" ? season.priceCents : 0,
    mostPopular: ev.slug.startsWith("pioneer_day"),
  }));

  return <HolidayPicker orgName={org.name} holidays={holidays} />;
}
