import { getServerSession } from "next-auth";
import { authOptions, ROLES } from "@service-projects/core-auth";
import { prisma } from "@service-projects/database";
import { Card, Badge, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { setUserRole } from "./actions";

// Always fresh: role changes here must show up immediately. Auth gate,
// topbar, and tabs are handled by ../layout.tsx — this page only owns
// its own content.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const canGrantOwner = session?.user.role === "OWNER";

  const users = await prisma.user.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <>
      <Card>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.users.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.users.subtitle")}</p>

        <form action={setUserRole} className="admin-formRow">
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">{t("admin.users.form.email")}</span>
            <input className="signup-input" type="email" name="email" required />
          </label>
          <label className="signup-field" style={{ marginBottom: 0 }}>
            <span className="signup-fieldLabel">{t("admin.users.form.role")}</span>
            <select className="signup-input" name="role" defaultValue="PREVIEWER">
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
          <div className="admin-tableWrap">
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
