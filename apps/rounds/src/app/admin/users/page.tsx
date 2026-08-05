import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, requireRole, can, ROLES } from "@service-projects/core-auth";
import { prisma } from "@service-projects/database";
import { Card, Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { setUserRole } from "./actions";
import { AccountControls } from "../../AccountControls";
import { PreviewRoleSwitcher } from "../../PreviewRoleSwitcher";
import { getEffectiveRole, PREVIEW_COOKIE } from "@/lib/previewRole";

// Always fresh: role changes here must show up immediately.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  // Real security gate — always the real session, never the preview.
  await requireRole(session, ["OWNER", "ADMIN"]);

  const realRole = session!.user.role;
  const role = getEffectiveRole(session) ?? realRole;
  const currentPreview = cookies().get(PREVIEW_COOKIE)?.value ?? "REAL";
  const isPreviewing = role !== realRole;

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

  // Previewing as a role that couldn't actually see this page — show
  // what that experience looks like instead of the real admin content.
  // The real requireRole check above already ran, so this is purely
  // cosmetic, not a security boundary.
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

  const users = await prisma.user.findMany({ orderBy: { updatedAt: "desc" } });
  const canGrantOwner = realRole === "OWNER";

  return (
    <main className="rounds-shell">
      {previewControls}

      {isPreviewing && (
        <Card style={{ marginBottom: "var(--space-6)", background: "var(--color-accent-100)" }}>
          <p style={{ margin: 0, color: "var(--color-accent-700)", fontSize: "var(--text-sm)" }}>
            {t("preview.banner", { role })}
          </p>
        </Card>
      )}

      <Card>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.users.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.users.subtitle")}</p>

        <form action={setUserRole} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {t("admin.users.form.email")}
            </span>
            <input
              type="email"
              name="email"
              required
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--surface-sunken)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {t("admin.users.form.role")}
            </span>
            <select
              name="role"
              defaultValue="PREVIEWER"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
                background: "var(--surface-sunken)",
                color: "var(--text-primary)",
              }}
            >
              {ROLES.filter((role) => role !== "OWNER" || canGrantOwner).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">
            {t("admin.users.form.submit")}
          </Button>
        </form>
        {!canGrantOwner && (
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
            {t("admin.users.form.ownerRestricted")}
          </p>
        )}
      </Card>

      <Card style={{ marginTop: "var(--space-6)" }}>
        {users.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("admin.users.empty")}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>{t("admin.users.table.email")}</th>
                <th style={thStyle}>{t("admin.users.table.name")}</th>
                <th style={thStyle}>{t("admin.users.table.role")}</th>
                <th style={thStyle}>{t("admin.users.table.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>{user.name ?? "—"}</td>
                  <td style={tdStyle}>
                    <Badge tone="accent">{user.role}</Badge>
                  </td>
                  <td style={tdStyle}>{user.updatedAt.toLocaleDateString()}</td>
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
