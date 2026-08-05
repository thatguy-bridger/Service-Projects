import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import { prisma } from "@service-projects/database";

// Admin-only screen for creating the data end users will view/interact with.
export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  requireRole(session, "ADMIN");

  const records = await prisma.serviceRecord.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main>
      <h1>Admin: Manage Service Records</h1>
      <ul>
        {records.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </main>
  );
}
