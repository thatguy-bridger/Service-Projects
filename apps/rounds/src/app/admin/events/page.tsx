import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, requireRole, can } from "@service-projects/core-auth";
import { defaultOrganization, currentSeasonForOrg } from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";
import { t } from "@/copy";
import { AccountControls } from "../../AccountControls";
import { PreviewRoleSwitcher } from "../../PreviewRoleSwitcher";
import { getEffectiveRole, PREVIEW_COOKIE } from "@/lib/previewRole";
import { formatHolidayDate } from "@/lib/format";
import { GenerateSeasonForm } from "./GenerateSeasonForm";
import { CreateEventForm } from "./CreateEventForm";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const realRole = session!.user.role;
  const role = getEffectiveRole(session) ?? realRole;
  const currentPreview = cookies().get(PREVIEW_COOKIE)?.value ?? "REAL";

  const previewControls = (
    <header className="rounds-topbar" style={{ justifyContent: "space-between" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span className="rounds-brand">{t("brand.name")}</span>
        <Badge tone="accent">{role}</Badge>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <PreviewRoleSwitcher currentPreview={currentPreview} />
        <AccountControls />
      </span>
    </header>
  );

  if (!can(role, "users.manageRoles")) {
    return (
      <main className="rounds-shell">
        {previewControls}
        <Card>
          <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
            {t("preview.forbidden.title", { role })}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("preview.forbidden.body", { role })}</p>
        </Card>
      </main>
    );
  }

  const org = await defaultOrganization();
  const season = org ? await currentSeasonForOrg(org.id) : null;
  const nextYear = new Date().getUTCFullYear() + 1;

  return (
    <main className="rounds-shell">
      {previewControls}

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.events.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          {org ? t("admin.events.currentOrg", { name: org.name }) : t("admin.events.noOrg")}
        </p>
      </Card>

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("admin.events.generate.title")}
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>{t("admin.events.generate.subtitle")}</p>
        <GenerateSeasonForm defaultOrgName={org?.name ?? ""} defaultYear={nextYear} />
      </Card>

      <Card style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("admin.events.custom.title")}
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>{t("admin.events.custom.subtitle")}</p>
        <CreateEventForm defaultOrgName={org?.name ?? ""} />
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("admin.events.list.title")}
        </h2>
        {!season || season.events.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.events.list.empty")}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("admin.events.list.name")}</th>
                <th style={thStyle}>{t("admin.events.list.date")}</th>
                <th style={thStyle}>{t("admin.events.list.status")}</th>
              </tr>
            </thead>
            <tbody>
              {season.events.map((ev) => (
                <tr key={ev.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                  <td style={tdStyle}>{ev.name}</td>
                  <td style={tdStyle}>{formatHolidayDate(ev.serviceStartsAt)}</td>
                  <td style={tdStyle}>
                    <Badge tone="success">{ev.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
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
