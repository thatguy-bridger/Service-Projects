"use client";

import { useEffect } from "react";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";

// A household hitting a real error here is the worst place for it to
// happen — mid-signup, on a phone. Give them a plain retry instead of
// the framework's default crash screen or a blank page.
export default function SignupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- no error-reporting service
    // wired up yet (see docs/rounds/OPEN-QUESTIONS.md).
    console.error(error);
  }, [error]);

  return (
    <div className="signup-shell">
      <div className="signup-intro" style={{ padding: "var(--space-16) var(--space-5)", textAlign: "center" }}>
        <h1>{t("signup.error.title")}</h1>
        <p>{t("signup.error.body")}</p>
        <Button variant="primary" onClick={reset}>
          {t("signup.error.retry")}
        </Button>
      </div>
    </div>
  );
}
