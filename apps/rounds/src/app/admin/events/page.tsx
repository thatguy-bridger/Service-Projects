import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { defaultOrganization, eventsForSession, categoriesForOrg } from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { GenerateSeasonForm } from "./GenerateSeasonForm";
import { CreateEventForm } from "./CreateEventForm";

// The top of the directory: (Events) -> category (Flag Setup, Flag
// Takedown, ...) -> individual opportunities (this year's Pioneer Day,
// last year's, ...) -> that opportunity's own people/signups/data
// (admin/events/[eventId]). Auth gate/topbar/tabs are ../layout.tsx.
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const session = await getServerSession(authOptions);
  const org = await defaultOrganization();
  const events = org ? await eventsForSession(session, org.id) : [];
  const nextYear = new Date().getUTCFullYear() + 1;

  const categories = org ? await categoriesForOrg(org.id) : [];
  const uncategorizedCount = events.filter((ev) => !ev.categoryId).length;

  return (
    <>
      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.events.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          {org ? t("admin.events.currentOrg", { name: org.name }) : t("admin.events.noOrg")}
        </p>
      </Card>

      <div className="admin-columns">
        <Card>
          <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
            {t("admin.events.generate.title")}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.events.generate.subtitle")}</p>
          <GenerateSeasonForm defaultOrgName={org?.name ?? ""} defaultYear={nextYear} />
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
            {t("admin.events.custom.title")}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.events.custom.subtitle")}</p>
          <CreateEventForm defaultOrgName={org?.name ?? ""} />
        </Card>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "var(--space-6) 0 var(--space-3)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("admin.events.categories.title")}
        </h2>
        <a href="/admin/categories" style={{ color: "var(--color-accent-600)", fontSize: "var(--text-sm)" }}>
          Manage categories
        </a>
      </div>
      <div className="admin-columns">
        {categories.map((cat) => (
          <a key={cat.id} href={`/admin/events/by-category/${cat.id}`} style={{ textDecoration: "none" }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>
                  {cat.name}
                </h3>
                <Badge tone="accent">{cat._count.events}</Badge>
              </div>
            </Card>
          </a>
        ))}
        <a href="/admin/events/by-category/uncategorized" style={{ textDecoration: "none" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>
                Uncategorized
              </h3>
              <Badge tone="neutral">{uncategorizedCount}</Badge>
            </div>
          </Card>
        </a>
      </div>
    </>
  );
}
