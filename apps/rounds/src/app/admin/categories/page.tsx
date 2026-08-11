import { notFound } from "next/navigation";
import { defaultOrganization, categoriesForOrg } from "@service-projects/database";
import { Card } from "@service-projects/ui";
import { CategoriesClient } from "./CategoriesClient";

export const dynamic = "force-dynamic";

// Auth gate/topbar/tabs come from ../layout.tsx (OWNER/ADMIN only).
export default async function CategoriesPage() {
  const org = await defaultOrganization();
  if (!org) notFound();

  const categories = await categoriesForOrg(org.id);

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        Categories
      </h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
        Group your events however makes sense for your org. Create, rename, or delete categories here — assign
        events to one from an event&apos;s Settings tab. Publishing happens here too: a category only appears on
        public signup once you set its Signup status to Published, which also opens any of its events still in
        Draft.
      </p>
      <CategoriesClient
        initialRows={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          eventCount: c._count.events,
          priceCents: c.priceCents,
          publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
        }))}
      />
    </Card>
  );
}
