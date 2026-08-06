"use client";

import { useEffect } from "react";
import { Card, Button } from "@service-projects/ui";
import { t } from "@/copy";

// Next.js error boundary for everything under /admin — SPEC.md §13's
// list rule calls for a real error state, not a blank screen or the
// framework's default crash overlay. `reset()` re-renders the segment
// without a full page reload, so a transient failure (a dropped DB
// connection, a flaky fetch) recovers in place.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- there's no error-reporting
    // service wired up yet (see docs/rounds/OPEN-QUESTIONS.md); this is
    // the honest current behavior, not a placeholder for one.
    console.error(error);
  }, [error]);

  return (
    <Card>
      <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
        {t("admin.error.title")}
      </h1>
      <p style={{ color: "var(--text-secondary)" }}>{t("admin.error.body")}</p>
      <Button variant="secondary" onClick={reset}>
        {t("admin.error.retry")}
      </Button>
    </Card>
  );
}
