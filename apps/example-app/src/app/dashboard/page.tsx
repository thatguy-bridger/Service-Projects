import { prisma } from "@service-projects/database";
import { Card, Badge } from "@service-projects/ui";

// Regular users land here to view/interact with admin-created records.
export default async function DashboardPage() {
  const records = await prisma.serviceRecord.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ padding: "var(--space-12)" }}>
      <h1>Service Records</h1>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        {records.map((r) => (
          <Card key={r.id}>
            <Badge tone="accent">Admin</Badge>
            <h3>{r.title}</h3>
            <p style={{ color: "var(--text-secondary)" }}>
              by {r.author.name ?? r.author.email}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
