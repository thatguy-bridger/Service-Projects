import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, householdForSession } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { EditHouseholdForm } from "./EditHouseholdForm";

export const dynamic = "force-dynamic";

export default async function AdminHouseholdDetailPage({ params }: { params: { householdId: string } }) {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) notFound();

  const household = await householdForSession(session, org.id, params.householdId);
  if (!household) notFound();

  return (
    <>
      <a href="/admin/library" style={{ color: "var(--color-accent-500)", fontSize: "var(--text-sm)" }}>
        {t("admin.eventDetail.back")}
      </a>

      <Card style={{ marginTop: "var(--space-3)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.household.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.household.subtitle")}</p>
        <EditHouseholdForm household={household} />
      </Card>
    </>
  );
}
