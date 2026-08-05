import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventsForSession, type EventKind } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { EVENT_KIND_LABELS, EVENT_KINDS } from "@/lib/eventKinds";
import { OpportunitiesTable } from "./OpportunitiesTable";

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
          <OpportunitiesTable opportunities={opportunities} />
        )}
      </Card>
    </>
  );
}
