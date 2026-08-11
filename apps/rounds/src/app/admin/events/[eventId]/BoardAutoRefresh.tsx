"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// A wall display has no one sitting there clicking refresh -- it just
// needs to keep itself current. router.refresh() re-runs the server
// component's data fetch in place (no full reload, no flash), so this
// is the whole mechanism; no websocket/polling-endpoint infra needed
// for something that only has to be "current within a few seconds,"
// not truly realtime.
export function BoardAutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
