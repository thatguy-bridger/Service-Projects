import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, can } from "@service-projects/core-auth";
import { Button, Card, Badge, BrandMark, ImagePlaceholder } from "@service-projects/ui";
import { t } from "@/copy";
import { AccountControls } from "./AccountControls";
import { PreviewRoleSwitcher } from "./PreviewRoleSwitcher";
import { getEffectiveRole, PREVIEW_COOKIE } from "@/lib/previewRole";

// Always fresh: reads the request's session.
export const dynamic = "force-dynamic";

// Every brand-new account lands here as a Previewer (SPEC.md §3) — there's
// no key redemption yet (that ships in Phase 5), so for now this page
// *is* the entire Previewer experience: sign in, see that there's nothing
// published yet, in the app's real tokens and copy registry.
export default async function HomePage({
  searchParams,
}: {
  searchParams: { welcomed?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="rounds-shell">
        <header className="rounds-topbar">
          <BrandMark />
          <span className="rounds-brand">{t("brand.name")}</span>
        </header>

        <section className="rounds-hero">
          <h1>{t("previewer.landing.title")}</h1>
          <p>{t("previewer.landing.subtitle")}</p>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <a href="/api/auth/signin">
              <Button variant="primary">{t("auth.signIn.cta")}</Button>
            </a>
            <a href="/register" style={{ color: "var(--color-accent-500)", fontSize: "var(--text-sm)" }}>
              {t("auth.createAccount.cta")}
            </a>
          </div>
        </section>

        <ImagePlaceholder
          caption={t("landing.imagePlaceholder.caption")}
          style={{ margin: "var(--space-8) 0" }}
        />

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
            {t("landing.howItWorks.title")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            <Card>
              <Badge tone="accent">1</Badge>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)" }}>
                {t("landing.howItWorks.step1.title")}
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("landing.howItWorks.step1.body")}</p>
            </Card>
            <Card>
              <Badge tone="accent">2</Badge>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)" }}>
                {t("landing.howItWorks.step2.title")}
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("landing.howItWorks.step2.body")}</p>
            </Card>
            <Card>
              <Badge tone="accent">3</Badge>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)" }}>
                {t("landing.howItWorks.step3.title")}
              </h3>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("landing.howItWorks.step3.body")}</p>
            </Card>
          </div>
        </section>
      </main>
    );
  }

  const realRole = session.user.role;

  // Brand-new accounts land as PREVIEWER with onboardedAt unset — send
  // them to pick what they're here to do before showing the empty
  // previewer state. Only PREVIEWER: an Owner/Admin/Coordinator/
  // Volunteer already has a defined position and shouldn't be asked.
  if (realRole === "PREVIEWER" && !session.user.onboardedAt) {
    redirect("/welcome");
  }

  const canPreview = realRole === "OWNER" || realRole === "ADMIN";
  const role = getEffectiveRole(session) ?? realRole;
  const isPreviewing = canPreview && role !== realRole;
  const isOwnerOrAdmin = can(role, "users.manageRoles");
  const currentPreview = cookies().get(PREVIEW_COOKIE)?.value ?? "REAL";

  return (
    <main className="rounds-shell">
      <header className="rounds-topbar" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <BrandMark size={32} />
          <span className="rounds-brand">{t("brand.name")}</span>
          <Badge tone="accent">{isOwnerOrAdmin ? role : t("role.previewer.badge")}</Badge>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          {canPreview && <PreviewRoleSwitcher currentPreview={currentPreview} />}
          <AccountControls />
        </span>
      </header>

      {searchParams.welcomed === "volunteer" && (
        <Card style={{ marginBottom: "var(--space-6)", background: "var(--color-accent-100)" }}>
          <p style={{ margin: 0, color: "var(--color-accent-700)", fontSize: "var(--text-sm)" }}>
            {t("welcome.volunteer.thanks")}
          </p>
        </Card>
      )}

      {isPreviewing && (
        <Card style={{ marginBottom: "var(--space-6)", background: "var(--color-accent-100)" }}>
          <p style={{ margin: 0, color: "var(--color-accent-700)", fontSize: "var(--text-sm)" }}>
            {t("preview.banner", { role })}
          </p>
        </Card>
      )}

      {isOwnerOrAdmin && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
            {t("dashboard.greeting", { role })}
          </p>
          <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
                {t("dashboard.manageEvents.title")}
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>{t("dashboard.manageEvents.body")}</p>
              <a href="/admin/events">
                <Button variant="secondary">{t("dashboard.manageEvents.cta")}</Button>
              </a>
            </div>
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
                {t("dashboard.manageUsers.title")}
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>{t("dashboard.manageUsers.body")}</p>
              <a href="/admin/users">
                <Button variant="secondary">{t("dashboard.manageUsers.cta")}</Button>
              </a>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2 style={{ margin: "0 0 8px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-medium)" }}>
          {t("previewer.emptyState.title")}
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("previewer.emptyState.body")}</p>
      </Card>
    </main>
  );
}
