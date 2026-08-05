import { prisma } from "../client";

// Seasons and their holiday events are public information (the whole
// point is a household can browse and sign up with no account — SPEC.md
// §3.2), so this isn't session-gated like the other scoped helpers. It
// still lives here rather than a raw `prisma.season` call in app code,
// for the same reason as everything else in this directory: one place
// that knows how to ask for this data correctly.
export async function currentSeasonForOrg(orgId: string) {
  return prisma.season.findFirst({
    where: { orgId },
    orderBy: { year: "desc" },
    include: {
      events: {
        where: { deletedAt: null, status: "OPEN" },
        orderBy: { serviceStartsAt: "asc" },
      },
    },
  });
}
