"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  importAddressPointsCsv,
  importAddressPointBatch,
  deleteAddressPointSource,
  type ImportAddressPointsResult,
  type ImportAddressPointBatchResult,
  type AddressPointDraft,
} from "@service-projects/database";

export async function importAddressPointsAction(csvText: string, source: string): Promise<ImportAddressPointsResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const result = await importAddressPointsCsv(session, csvText, source);
  revalidatePath("/admin/address-points");
  return result;
}

// Used by the client-side-parse-and-batch-upload flow: the browser
// parses the whole file, then calls this once per small batch so no
// single request body approaches Vercel's serverless size cap. The
// caller is responsible for calling revalidatePath itself only after
// the last batch -- doing it on every batch would just thrash the
// cache for no benefit.
export async function importAddressPointBatchAction(
  rows: AddressPointDraft[],
  source: string,
  isFirstBatch: boolean
): Promise<ImportAddressPointBatchResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const result = await importAddressPointBatch(session, rows, source, isFirstBatch);
  if (isFirstBatch || result.ok) revalidatePath("/admin/address-points");
  return result;
}

export async function deleteAddressPointSourceAction(source: string): Promise<{ ok: boolean; deleted: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const result = await deleteAddressPointSource(session, source);
  revalidatePath("/admin/address-points");
  return result;
}
