import { notFound } from "next/navigation";
import {
  defaultOrganization,
  organizationSettings,
  adminDashboardLayoutForOrg,
  publicFormLayoutForOrg,
} from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { OrganizationForm } from "./OrganizationForm";
import { DashboardLayoutEditor } from "./DashboardLayoutEditor";
import { PublicFormLayoutEditor } from "./PublicFormLayoutEditor";

// The "unlimited access" admin view of Organization -- OWNER/ADMIN only
// (gated by the shared ../layout.tsx requireRole check). Pricing used to
// live here as a per-season table; it's now set directly on each Event
// (and, for a bundle price, on each Category) -- see /admin/events and
// /admin/categories.
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const org = await defaultOrganization();
  if (!org) notFound();

  const dashboardLayout = await adminDashboardLayoutForOrg(org.id);
  const publicFormLayout = await publicFormLayoutForOrg(org.id);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <Card>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("admin.settings.orgTitle")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.settings.orgSubtitle")}</p>
        <OrganizationForm name={org.name} emailFrom={organizationSettings(org).emailFrom ?? ""} />
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
          Home dashboard layout
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          What Owners and Admins see on the home screen (SPEC.md §11.3).
        </p>
        <DashboardLayoutEditor initialLayout={dashboardLayout} />
      </Card>

      <Card>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>
          Signup form layout
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          What wraps the public signup form (SPEC.md §11.3).
        </p>
        <PublicFormLayoutEditor initialLayout={publicFormLayout} />
      </Card>
    </div>
  );
}
