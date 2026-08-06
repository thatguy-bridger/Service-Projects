import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, requireRole, can } from "@service-projects/core-auth";
import { Card, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { AppTopbar } from "../AppTopbar";
import { getEffectiveRole } from "@/lib/previewRole";
import { AdminTabs } from "./AdminTabs";

// Shared shell for every /admin/* page: one auth gate, one topbar with
// role preview + account controls, one tab nav — pages under here just
// render their own content. Real security gate is requireRole against
// the *real* session; the preview-role forbidden view below it is
// cosmetic only (see docs/rounds/PHASE-0.md's role-preview notes).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // requireRole throws a plain Error when there's no session at all,
  // which the nearest error boundary renders as a generic "Something
  // went wrong" crash screen -- confusing for the common case of a
  // signed-out visitor just clicking an /admin link. Send them to sign
  // in instead; requireRole below still handles "signed in, wrong role".
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=/admin`);
  }

  await requireRole(session, ["OWNER", "ADMIN"]);

  const realRole = session!.user.role;
  const role = getEffectiveRole(session) ?? realRole;
  const isPreviewing = role !== realRole;

  if (!can(role, "users.manageRoles")) {
    return (
      <>
        <AppTopbar section={t("admin.tabs.nav")} />
        <main className="admin-shell">
          <Card>
            <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
              {t("preview.forbidden.title", { role })}
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>{t("preview.forbidden.body", { role })}</p>
            <a href="/">
              <Button variant="secondary">{t("preview.forbidden.backHome", { role })}</Button>
            </a>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <AppTopbar section={t("admin.tabs.nav")} />
      <main className="admin-shell">
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
    </>
  );
}
