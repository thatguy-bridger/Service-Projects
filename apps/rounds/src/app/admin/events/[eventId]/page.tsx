import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventForSession, householdsForEvent } from "@service-projects/database";
import { Card, Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { formatCentsFull, formatHolidayDate } from "@/lib/format";
import { ImportCsvForm } from "./ImportCsvForm";

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
          <div className="admin-tableWrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("admin.eventDetail.list.name")}</th>
                  <th style={thStyle}>{t("admin.eventDetail.list.contact")}</th>
                  <th style={thStyle}>{t("admin.eventDetail.list.address")}</th>
                  <th style={thStyle}>{t("admin.eventDetail.list.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.subscriptionEventId} style={{ borderTop: "1px solid var(--border-default)" }}>
                    <td style={tdStyle}>{row.household.contactName}</td>
                    <td style={tdStyle}>
                      {row.household.contactEmail}
                      {row.household.contactEmail && row.household.contactPhone ? " · " : ""}
                      {row.household.contactPhone}
                    </td>
                    <td style={tdStyle}>{row.household.addressInput}</td>
                    <td style={tdStyle}>
                      <Badge tone={row.skipped ? "neutral" : "accent"}>
                        {row.skipped ? t("admin.eventDetail.list.skipped") : row.subscriptionStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  fontWeight: "var(--weight-medium)" as unknown as number,
};

const tdStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-sm)",
};
