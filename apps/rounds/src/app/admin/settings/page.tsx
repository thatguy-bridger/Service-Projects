import { notFound } from "next/navigation";
import { defaultOrganization, allSeasonsForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { OrganizationForm } from "./OrganizationForm";
import { SeasonRow } from "./SeasonRow";

// The "unlimited access" admin view of models that otherwise have no
// dedicated UI at all — Organization and Season — for OWNER/ADMIN only
// (gated by the shared ../layout.tsx requireRole check).
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const org = await defaultOrganization();
  if (!org) notFound();

  const seasons = await allSeasonsForOrg(org.id);

  return (
    <>
      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.settings.orgTitle")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.settings.orgSubtitle")}</p>
        <OrganizationForm name={org.name} />
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("admin.settings.seasonsTitle")}
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.settings.seasonsSubtitle")}</p>

        {seasons.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.settings.seasonsEmpty")}</p>
        ) : (
          <div className="admin-tableWrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("admin.settings.seasonYear")}</th>
                  <th style={thStyle}>{t("admin.settings.seasonName")}</th>
                  <th style={thStyle}>{t("admin.settings.seasonMode")}</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((season) => (
                  <SeasonRow key={season.id} season={season} />
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
