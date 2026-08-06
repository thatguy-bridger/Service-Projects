import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { Badge, BrandMark, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { AccountControls } from "./AccountControls";
import { PreviewRoleSwitcher } from "./PreviewRoleSwitcher";
import { getEffectiveRole, PREVIEW_COOKIE } from "@/lib/previewRole";

// The one topbar every screen renders — signed in or not, admin or
// public. Before this, page.tsx/welcome/admin each hand-rolled their own
// copy of this header (and /signup and /register had none at all), so
// "where am I / who am I / what can I do from here" answered differently
// screen to screen. One component, one answer, everywhere.
export async function AppTopbar({ section }: { section?: string }) {
  const session = await getServerSession(authOptions);
  const signedIn = !!session?.user;
  const realRole = session?.user.role;
  const role = signedIn ? getEffectiveRole(session) ?? realRole : null;
  const canPreview = signedIn && (realRole === "OWNER" || realRole === "ADMIN");
  const currentPreview = cookies().get(PREVIEW_COOKIE)?.value ?? "REAL";
  const isStaffRole = role === "OWNER" || role === "ADMIN" || role === "COORDINATOR";

  return (
    <header className="rounds-topbar" style={{ justifyContent: "space-between" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <a
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", textDecoration: "none", color: "inherit" }}
        >
          <BrandMark size={32} />
          <span className="rounds-brand">{t("brand.name")}</span>
        </a>
        {section && (
          <>
            <span aria-hidden style={{ color: "var(--text-muted)" }}>
              /
            </span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{section}</span>
          </>
        )}
        {signedIn && isStaffRole && (
          <a href="/admin/events" style={{ fontSize: "var(--text-sm)", color: "var(--color-accent-600)" }}>
            {t("nav.admin")}
          </a>
        )}
        {signedIn && role && <Badge tone="accent">{role}</Badge>}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        {canPreview && <PreviewRoleSwitcher currentPreview={currentPreview} />}
        {signedIn ? (
          <AccountControls />
        ) : (
          <a href="/api/auth/signin">
            <Button variant="ghost">{t("auth.signIn.cta")}</Button>
          </a>
        )}
      </span>
    </header>
  );
}
