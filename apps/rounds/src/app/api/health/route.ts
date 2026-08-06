import { NextResponse } from "next/server";
import { prisma } from "@service-projects/database";

// Public, unauthenticated by design — an uptime monitor (or a load
// balancer's health check) needs to reach this without a session. It
// intentionally reveals nothing sensitive: no counts, no org names,
// just "can this instance reach its database right now."
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
