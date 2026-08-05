import { prisma } from "@service-projects/database";

// Regular users land here to view/interact with admin-created records.
export default async function DashboardPage() {
  const records = await prisma.serviceRecord.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <h1>Service Records</h1>
      <ul>
        {records.map((r) => (
          <li key={r.id}>
            {r.title} — by {r.author.name ?? r.author.email}
          </li>
        ))}
      </ul>
    </main>
  );
}
