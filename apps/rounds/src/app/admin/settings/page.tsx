import { notFound } from "next/navigation";
import { defaultOrganization, organizationSettings } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { t } from "@/copy";
import { OrganizationForm } from "./OrganizationForm";

// The "unlimited access" admin view of Organization -- OWNER/ADMIN only
// (gated by the shared ../layout.tsx requireRole check). Pricing used to
// live here as a per-season table; it's now set directly on each Event
// (and, for a bundle price, on each Category) -- see /admin/events and
// /admin/categories.
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const org = await defaultOrganization();
  if (!org) notFound();

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        {t("admin.settings.orgTitle")}
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("admin.settings.orgSubtitle")}</p>
      <OrganizationForm name={org.name} emailFrom={organizationSettings(org).emailFrom ?? ""} />
    </Card>
  );
}
