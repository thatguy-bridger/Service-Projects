import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventsForSession, type EventKind } from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { formatHolidayDate } from "@/lib/format";
import { EVENT_KIND_LABELS, EVENT_KINDS } from "@/lib/eventKinds";

export const dynamic = "force-dynamic";

export default async function AdminEventCategoryPage({ params }: { params: { kind: string } }) {
  const kind = params.kind as EventKind;
  if (!EVENT_KINDS.includes(kind)) notFound();

  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const events = org ? await eventsForSession(session, org.id) : [];
  const opportunities = events.filter((ev) => ev.kind === kind);

  return (
    <>
      <a href="/admin/events" style={{ color: "var(--color-accent-500)", fontSize: "var(--text-sm)" }}>
        {t("admin.eventDetail.back")}
      </a>

      <Card style={{ marginTop: "var(--space-3)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {EVENT_KIND_LABELS[kind]}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          {t("admin.events.category.subtitle")}
        </p>

        {opportunities.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.events.category.empty")}</p>
        ) : (
          <div className="admin-tableWrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("admin.events.list.name")}</th>
                  <th style={thStyle}>{t("admin.events.list.date")}</th>
                  <th style={thStyle}>{t("admin.events.list.status")}</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((ev) => (
                  <tr key={ev.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                    <td style={tdStyle}>
                      <a
                        href={`/admin/events/${ev.id}`}
                        style={{ color: "var(--color-accent-600)", fontWeight: "var(--weight-medium)" as unknown as number }}
                      >
                        {ev.name}
                      </a>
                    </td>
                    <td style={tdStyle}>{formatHolidayDate(ev.serviceStartsAt)}</td>
                    <td style={tdStyle}>
                      <Badge tone="success">{ev.status}</Badge>
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
