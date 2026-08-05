import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, requireRole, can } from "@service-projects/core-auth";
import { Card, Badge, BrandMark } from "@service-projects/ui";
import { t } from "@/copy";
import { AccountControls } from "../AccountControls";
import { PreviewRoleSwitcher } from "../PreviewRoleSwitcher";
import { getEffectiveRole, PREVIEW_COOKIE } from "@/lib/previewRole";
import { AdminTabs } from "./AdminTabs";

// Shared shell for every /admin/* page: one auth gate, one topbar with
// role preview + account controls, one tab nav — pages under here just
// render their own content. Real security gate is requireRole against
// the *real* session; the preview-role forbidden view below it is
// cosmetic only (see docs/rounds/PHASE-0.md's role-preview notes).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const realRole = session!.user.role;
  const role = getEffectiveRole(session) ?? realRole;
  const currentPreview = cookies().get(PREVIEW_COOKIE)?.value ?? "REAL";
  const isPreviewing = role !== realRole;

  const header = (
    <header className="rounds-topbar" style={{ justifyContent: "space-between" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <BrandMark size={32} />
        <span className="rounds-brand">{t("brand.name")}</span>
        <Badge tone="accent">{role}</Badge>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <PreviewRoleSwitcher currentPreview={currentPreview} />
        <AccountControls />
      </span>
    </header>
  );

  if (!can(role, "users.manageRoles")) {
    return (
      <main className="admin-shell">
        {header}
        <Card>
          <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
            {t("preview.forbidden.title", { role })}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>{t("preview.forbidden.body", { role })}</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      {header}

      {isPreviewing && (
        <Card style={{ marginBottom: "var(--space-6)", background: "var(--color-accent-100)" }}>
          <p style={{ margin: 0, color: "var(--color-accent-700)", fontSize: "var(--text-sm)" }}>
            {t("preview.banner", { role })}
          </p>
        </Card>
      )}

      <AdminTabs />
      {children}
    </main>
  );
}
