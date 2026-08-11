import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import {
  defaultOrganization,
  eventForSession,
  householdsForEvent,
  membershipsForEvent,
  categoriesForOrg,
  routesForEvent,
  stopsForSession,
  normalizeStopCardLayout,
  normalizeRouteScreenLayout,
  normalizeEventLandingLayout,
} from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { formatCentsFull, formatHolidayDate } from "@/lib/format";
import { EventDetailTabs } from "./EventDetailTabs";
import { ExportLink } from "./ExportLink";

// This is the point of the whole admin flow: click an event, land on
// *that event's* dataset — households/signups scoped to just this one
// event, not the whole org. Auth gate/topbar/tabs come from
// ../../layout.tsx; eventForSession below does the event-scoped
// membership check on top of that.
export const dynamic = "force-dynamic";

function toDateInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export default async function AdminEventDetailPage({ params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) notFound();

  const event = await eventForSession(session, org.id, params.eventId);
  if (!event) notFound();

  const rows = await householdsForEvent(session, org.id, params.eventId);
  const activeCount = rows.filter((r) => !r.skipped).length;
  const skippedCount = rows.length - activeCount;
  const totalCents = rows.filter((r) => !r.skipped).reduce((sum, r) => sum + r.amountCents, 0);
  const people = await membershipsForEvent(session, params.eventId);
  const categories = await categoriesForOrg(org.id);
  const routes = await routesForEvent(session, params.eventId);
  const pairedEvent = event.pairedEventId ? await eventForSession(session, org.id, event.pairedEventId) : null;
  const stops = await stopsForSession(session, params.eventId);

  return (
    <>
      <a href="/admin/events" style={{ color: "var(--color-accent-500)", fontSize: "var(--text-sm)" }}>
        {t("admin.eventDetail.back")}
      </a>

      <Card style={{ marginTop: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
              {event.name}
            </h1>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              {formatHolidayDate(event.serviceStartsAt)}
            </p>
          </div>
          <Badge tone="success">{event.status}</Badge>
        </div>
      </Card>

      <div className="admin-columns" style={{ marginBottom: "var(--space-6)" }}>
        <Card>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 4px", fontSize: "var(--text-sm)" }}>
            {t("admin.eventDetail.stats.signups")}
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>{activeCount}</p>
        </Card>
        <Card>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 4px", fontSize: "var(--text-sm)" }}>
            {t("admin.eventDetail.stats.skipped")}
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>{skippedCount}</p>
        </Card>
        <Card>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 4px", fontSize: "var(--text-sm)" }}>
            {t("admin.eventDetail.stats.total")}
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--weight-semibold)" }}>
            {formatCentsFull(totalCents)}
          </p>
        </Card>
      </div>

      <EventDetailTabs
        eventId={event.id}
        eventDatesRow={{
          id: event.id,
          name: event.name,
          status: event.status,
          priceCents: event.priceCents,
          serviceStartsAt: toDateInputValue(event.serviceStartsAt),
          serviceEndsAt: toDateInputValue(event.serviceEndsAt),
        }}
        signupRows={rows}
        people={people}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        currentCategoryId={event.categoryId}
        routes={routes}
        stops={stops.map((s) => ({
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          status: s.status,
          routeId: s.routeId,
          addressLine: s.addressLine,
        }))}
        kind={event.kind}
        pairedEventId={event.pairedEventId}
        pairedEventName={pairedEvent?.name ?? null}
        stopCardLayout={normalizeStopCardLayout(event.layoutBlocks)}
        routeScreenLayout={normalizeRouteScreenLayout(event.layoutBlocks)}
        eventLandingLayout={normalizeEventLandingLayout(event.layoutBlocks)}
      />

      <p style={{ marginTop: "var(--space-4)" }}>
        <ExportLink href={`/admin/events/${event.id}/export`} />
      </p>
    </>
  );
}
