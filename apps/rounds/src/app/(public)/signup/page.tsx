import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, openEventsForSignup, householdForUser, publicFormLayoutForOrg } from "@service-projects/database";
import { t } from "@/copy";
import { AppTopbar } from "../../AppTopbar";
import { SignupFlow } from "./SignupFlow";
import { PublicFormSlotBlocks } from "@/blocks/PublicFormBlocks";
import type { PublicFormFeaturedEvent } from "@service-projects/database/layoutBlocks";

// Public, no account — SPEC.md §14.1's "Flag signup" screen: holidays ->
// address -> contact/review. Stripe Checkout is follow-up work (needs
// real test keys, none exist in this environment) — see
// docs/rounds/PHASE-1.md. Submitting here creates a real
// Household/Subscription, left PENDING_PAYMENT rather than ACTIVE.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const events = org ? await openEventsForSignup(org.id) : [];
  const linkedHousehold =
    session?.user?.id && org ? await householdForUser(session.user.id, org.id) : null;

  if (!org || events.length === 0) {
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

  const publicFormLayout = await publicFormLayoutForOrg(org.id);
  const featuredEvent = events[0] ?? null;
  const featured: PublicFormFeaturedEvent | null = featuredEvent
    ? {
        name: featuredEvent.name,
        summary: featuredEvent.summary,
        coverImageUrl: featuredEvent.coverImageUrl,
        serviceStartsAt: featuredEvent.serviceStartsAt.toISOString(),
        priceCents: featuredEvent.priceCents,
      }
    : null;

  const holidays = events.map((ev) => ({
    id: ev.id,
    key: ev.slug,
    name: ev.name,
    date: ev.serviceStartsAt.toISOString(),
    priceCents: ev.priceCents,
    categoryId: ev.categoryId,
    categoryName: ev.category?.name ?? null,
    categoryBundlePriceCents: ev.category?.priceCents ?? null,
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
        <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <PublicFormSlotBlocks layout={publicFormLayout} slot="header" featured={featured} />
        </div>
        <SignupFlow
          orgId={org.id}
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
        <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
          <PublicFormSlotBlocks layout={publicFormLayout} slot="footer" featured={featured} />
        </div>
      </div>
    </>
  );
}
