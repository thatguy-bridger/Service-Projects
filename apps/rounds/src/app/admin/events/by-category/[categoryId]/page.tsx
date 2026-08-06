import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventsForSession, categoriesForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { OpportunitiesTable } from "../../OpportunitiesTable";

export const dynamic = "force-dynamic";
export default async function AdminEventsByCategoryPage({ params }: { params: { categoryId: string } }) {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  if (!org) notFound();

  const categories = await categoriesForOrg(org.id);
  const category = params.categoryId === "uncategorized" ? null : categories.find((c) => c.id === params.categoryId);
  if (params.categoryId !== "uncategorized" && !category) notFound();

  const events = await eventsForSession(session, org.id);
  const opportunities =
    params.categoryId === "uncategorized"
      ? events.filter((ev) => !ev.categoryId)
      : events.filter((ev) => ev.categoryId === params.categoryId);

  return (
    <>
      <a href="/admin/events" style={{ color: "var(--color-accent-500)", fontSize: "var(--text-sm)" }}>
        {t("admin.eventDetail.back")}
      </a>

      <Card style={{ marginTop: "var(--space-3)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {category ? category.name : "Uncategorized"}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          {t("admin.events.category.subtitle")}
        </p>

        <OpportunitiesTable
          opportunities={opportunities}
          fixedCategoryId={category ? category.id : null}
        />
      </Card>
    </>
  );
}
