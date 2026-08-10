import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions, can } from "@service-projects/core-auth";
import { Badge, BrandMark, Button } from "@service-projects/ui";
import { t } from "@/copy";
import { AccountControls } from "./AccountControls";
import { PreviewRoleSwitcher } from "./PreviewRoleSwitcher";
import { getEffectiveRole, PREVIEW_COOKIE } from "@/lib/previewRole";
import { TopNavMenu, type NavCategory } from "./TopNavMenu";

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
  const isAdmin = can(role, "users.manageRoles") || realRole === "ADMIN"; // admin/layout.tsx's own gate is OWNER/ADMIN
  const canSeeRoutes = signedIn && can(role, "route.viewAssigned");

  // Every category is built unconditionally, then filtered down to
  // items this role can actually reach -- so "someone with no
  // permission" (signed out, or a PREVIEWER) still gets a nav bar, just
  // a shorter one, rather than a special-cased empty state.
  const categories: NavCategory[] = [
    {
      label: "Browse",
      items: [
        { label: "Home", href: "/" },
        { label: "Sign up", href: "/signup" },
      ],
    },
    {
      label: "My work",
      items: canSeeRoutes ? [{ label: "My routes", href: "/my-routes" }] : [],
    },
    {
      label: "Admin",
      items:
        signedIn && isAdmin
          ? [
              { label: "Events", href: "/admin/events" },
              { label: "Categories", href: "/admin/categories" },
              { label: "Keys", href: "/admin/keys" },
              { label: "Library", href: "/admin/library" },
              { label: "Review queue", href: "/admin/review" },
              { label: "Users", href: "/admin/users" },
              { label: "Settings", href: "/admin/settings" },
            ]
          : [],
    },
  ];

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
        <TopNavMenu categories={categories} />
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
