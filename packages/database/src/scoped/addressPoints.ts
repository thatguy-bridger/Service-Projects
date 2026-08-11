import { prisma } from "../client";
import { isStaff, resolveMembership, type SessionLike } from "./membership";
import { parseAddressPoints, type AddressPointDraft } from "../addressPointParsing";

export type { AddressPointDraft };

export interface ImportAddressPointsResult {
  ok: boolean;
  error?: string;
  imported: number;
  skipped: number;
}

/**
 * Accepts either a CSV (header row + LAT/LON-style columns) or
 * newline-delimited GeoJSON (OpenAddresses.io's real export format,
 * one Feature per line) -- detected by whether the first non-blank
 * line looks like JSON, no format flag needed from the caller.
 *
 * Replaces an entire `source` batch in one go: every existing row
 * tagged with this source is deleted, then every valid row from the
 * new file is inserted. That's the whole "refresh" mechanism SPEC.md
 * §9.2 asks for ("refresh quarterly") -- re-import the same source
 * label with a fresh export and the old batch is gone. Different
 * counties/exports get different source labels and coexist;
 * re-importing one never touches another.
 */
export async function importAddressPointsCsv(
  session: SessionLike | null | undefined,
  fileText: string,
  source: string
): Promise<ImportAddressPointsResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) {
    return { ok: false, error: "Forbidden", imported: 0, skipped: 0 };
  }
  const trimmedSource = source.trim();
  if (!trimmedSource) return { ok: false, error: "A source label is required.", imported: 0, skipped: 0 };

  const { rows: toInsert, skipped } = parseAddressPoints(fileText);

  if (toInsert.length === 0 && skipped === 0) {
    return { ok: false, error: "No rows found in that file.", imported: 0, skipped: 0 };
  }
  if (toInsert.length === 0) {
    return { ok: false, error: "No valid rows to import — check the lat/lng data.", imported: 0, skipped };
  }

  // One createMany for the whole file breaks down at real-world sizes:
  // Postgres caps a single statement to 65535 bound parameters, and
  // this table binds 5 per row (lat/lng/fullAddress/city/zip/source is
  // 6, actually), so an unchunked call silently has a hard ceiling
  // around ~10-11k rows regardless of how much memory the request has
  // to spare -- a city-sized file (tens of thousands of points) would
  // hit that ceiling and fail outright, not just run slowly. Batching
  // keeps every statement well under the limit and lets Postgres commit
  // incrementally instead of building one enormous query plan.
  const BATCH_SIZE = 5000;
  const rowsWithSource = toInsert.map((r) => ({ ...r, source: trimmedSource }));
  const batches: (typeof rowsWithSource)[] = [];
  for (let i = 0; i < rowsWithSource.length; i += BATCH_SIZE) {
    batches.push(rowsWithSource.slice(i, i + BATCH_SIZE));
  }

  await prisma.$transaction([
    prisma.addressPoint.deleteMany({ where: { source: trimmedSource } }),
    ...batches.map((batch) => prisma.addressPoint.createMany({ data: batch })),
  ]);

  return { ok: true, imported: toInsert.length, skipped };
}

export interface ImportAddressPointBatchResult {
  ok: boolean;
  error?: string;
  imported: number;
}

/**
 * Inserts one already-parsed batch of rows for a source, used by the
 * client-side-parse-and-upload flow (AddressPointsClient.tsx parses the
 * whole file in the browser, then posts it here a few thousand rows at
 * a time so no single request body gets anywhere near Vercel's
 * serverless body-size cap). `isFirstBatch` triggers the same
 * replace-the-source semantics `importAddressPointsCsv` does in one
 * transaction -- delete any existing rows for this source before
 * inserting the first batch, then every later batch for the same
 * upload just appends.
 */
export async function importAddressPointBatch(
  session: SessionLike | null | undefined,
  rows: AddressPointDraft[],
  source: string,
  isFirstBatch: boolean
): Promise<ImportAddressPointBatchResult> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) {
    return { ok: false, error: "Forbidden", imported: 0 };
  }
  const trimmedSource = source.trim();
  if (!trimmedSource) return { ok: false, error: "A source label is required.", imported: 0 };
  if (rows.length === 0) return { ok: true, imported: 0 };

  const data = rows.map((r) => ({ ...r, source: trimmedSource }));

  if (isFirstBatch) {
    await prisma.$transaction([
      prisma.addressPoint.deleteMany({ where: { source: trimmedSource } }),
      prisma.addressPoint.createMany({ data }),
    ]);
  } else {
    await prisma.addressPoint.createMany({ data });
  }

  return { ok: true, imported: rows.length };
}

export interface AddressPointSourceRow {
  source: string;
  count: number;
  importedAt: string;
}

export async function addressPointSources(
  session: SessionLike | null | undefined
): Promise<AddressPointSourceRow[]> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return [];

  const grouped = await prisma.addressPoint.groupBy({
    by: ["source"],
    _count: { _all: true },
    _max: { importedAt: true },
    orderBy: { source: "asc" },
  });
  return grouped.map((g) => ({
    source: g.source,
    count: g._count._all,
    importedAt: (g._max.importedAt ?? new Date()).toISOString(),
  }));
}

export async function deleteAddressPointSource(
  session: SessionLike | null | undefined,
  source: string
): Promise<{ ok: boolean; deleted: number }> {
  const membership = await resolveMembership(session);
  if (!membership || !isStaff(membership.role)) return { ok: false, deleted: 0 };
  const result = await prisma.addressPoint.deleteMany({ where: { source } });
  return { ok: true, deleted: result.count };
}
