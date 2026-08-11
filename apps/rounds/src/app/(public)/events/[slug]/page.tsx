import { notFound } from "next/navigation";
import { defaultOrganization, openEventForLanding } from "@service-projects/database";
import { normalizeEventLandingLayout } from "@service-projects/database/layoutBlocks";
import { Card } from "@service-projects/ui";
import { AppTopbar } from "../../../AppTopbar";
import { EventLandingSlotBlocks, type EventLandingData } from "@/blocks/EventLandingBlocks";

// SPEC.md §11.3's event-landing screen -- a public teaser page for one
// event (hero, description, date, price, signup CTA), distinct from
// /signup itself which lets someone select several events at once.
// This page just links into /signup rather than being the signup.
export const dynamic = "force-dynamic";

export default async function EventLandingPage({ params }: { params: { slug: string } }) {
  const org = await defaultOrganization();
  const event = org ? await openEventForLanding(org.id, params.slug) : null;
  if (!org || !event) notFound();

  const layout = normalizeEventLandingLayout(event.layoutBlocks);

  const data: EventLandingData = {
    name: event.name,
    summary: event.summary,
    coverImageUrl: event.coverImageUrl,
    serviceStartsAt: event.serviceStartsAt.toISOString(),
    serviceEndsAt: event.serviceEndsAt.toISOString(),
    priceCents: event.priceCents,
    categoryName: event.category?.name ?? null,
    categoryBundlePriceCents: event.category?.priceCents ?? null,
  };

  return (
    <>
      <AppTopbar section={event.name} />
      <main className="rounds-shell">
        <EventLandingSlotBlocks layout={layout} slot="hero" data={data} />
        <Card style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-3)" }}>
          <EventLandingSlotBlocks layout={layout} slot="body" data={data} />
        </Card>
        <div style={{ marginTop: "var(--space-6)" }}>
          <EventLandingSlotBlocks layout={layout} slot="footer" data={data} />
        </div>
      </main>
    </>
  );
}
