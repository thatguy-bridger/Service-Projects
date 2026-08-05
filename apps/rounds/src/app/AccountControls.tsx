"use client";

import { signOut, signIn } from "next-auth/react";
import { Button } from "@service-projects/ui";
import { t } from "@/copy";

// Rendered only when a server component already knows the user is
// signed in, so this doesn't need its own session read (no
// SessionProvider wired up in the app — see layout.tsx).
export function AccountControls() {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <Button variant="ghost" onClick={() => signIn(undefined, { callbackUrl: "/" })}>
        {t("account.switchAccount.cta")}
      </Button>
      <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
        {t("account.signOut.cta")}
      </Button>
    </div>
  );
}
