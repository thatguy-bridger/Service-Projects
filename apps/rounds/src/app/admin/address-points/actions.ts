"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions, requireRole } from "@service-projects/core-auth";
import {
  importAddressPointsCsv,
  deleteAddressPointSource,
  type ImportAddressPointsResult,
} from "@service-projects/database";

export async function importAddressPointsAction(csvText: string, source: string): Promise<ImportAddressPointsResult> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const result = await importAddressPointsCsv(session, csvText, source);
  revalidatePath("/admin/address-points");
  return result;
}

export async function deleteAddressPointSourceAction(source: string): Promise<{ ok: boolean; deleted: number }> {
  const session = await getServerSession(authOptions);
  await requireRole(session, ["OWNER", "ADMIN"]);

  const result = await deleteAddressPointSource(session, source);
  revalidatePath("/admin/address-points");
  return result;
}
