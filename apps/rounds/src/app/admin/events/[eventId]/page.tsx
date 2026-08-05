import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventForSession, eventsForSession, householdsForEvent, membershipsForEvent } from "@service-projects/database";
import { Card, Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { formatCentsFull, formatHolidayDate } from "@/lib/format";
import { ImportCsvForm } from "./ImportCsvForm";
import { PeopleForm } from "./PeopleForm";
import { HouseholdsTable } from "./HouseholdsTable";
import { EditEventForm } from "./EditEventForm";

// This is the point of the whole admin flow: click an event, land on
// *that event's* dataset — households/signups scoped to just this one
// event, not the whole org. Auth gate/topbar/tabs come from
// ../../layout.tsx; eventForSession below does the event-scoped
// membership check on top of that.
export const dynamic = "force-dynamic";

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
  const allEvents = await eventsForSession(session, org.id);
  const otherEvents = allEvents
    .filter((ev) => ev.id !== event.id && ev.seasonId)
    .map((ev) => ({ id: ev.id, name: ev.name }));

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
        <EditEventForm
          eventId={event.id}
          name={event.name}
          status={event.status}
          serviceStartsAt={event.serviceStartsAt}
          serviceEndsAt={event.serviceEndsAt}
        />
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

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("admin.eventDetail.people.title")}
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>{t("admin.eventDetail.people.subtitle")}</p>
        <PeopleForm eventId={event.id} people={people} />
      </Card>

      {event.seasonId && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
            {t("admin.eventDetail.import.title")}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.eventDetail.import.subtitle")}</p>
          <ImportCsvForm eventId={event.id} />
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
            {t("admin.eventDetail.list.title")}
          </h2>
          <a href={`/admin/events/${event.id}/export`}>
            <Button variant="secondary">{t("admin.eventDetail.export")}</Button>
          </a>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.eventDetail.list.empty")}</p>
        ) : (
          <HouseholdsTable eventId={event.id} rows={rows} otherEvents={otherEvents} />
        )}
      </Card>
    </>
  );
}
