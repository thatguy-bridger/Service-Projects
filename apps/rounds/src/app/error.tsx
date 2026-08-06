"use client";

import { useEffect } from "react";
import { Button, Card } from "@service-projects/ui";
import { t } from "@/copy";

// Root-level error boundary — the framework's default is a raw crash
// screen with no brand, no way back, and (in production) no detail at
// all. This is the last line of defense for anything not already
// caught by a more specific error.tsx (admin/, signup/).
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- no error-reporting service
    // wired up yet (see docs/rounds/OPEN-QUESTIONS.md).
    console.error(error);
  }, [error]);

  return (
    <main className="rounds-shell">
      <Card>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("app.error.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>{t("app.error.body")}</p>
        <Button variant="primary" onClick={reset}>
          {t("app.error.retry")}
        </Button>
      </Card>
    </main>
  );
}
