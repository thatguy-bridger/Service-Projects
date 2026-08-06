"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@service-projects/core-auth";
import { recordVisit, type RecordVisitInput, type RecordVisitResult } from "@service-projects/database";

export async function recordVisitAction(input: RecordVisitInput): Promise<RecordVisitResult> {
  const session = await getServerSession(authOptions);
  return recordVisit(session, input);
}
