"use client";

import { useState } from "react";
import { Button, Card, Badge } from "@service-projects/ui";
import { redeemInviteKeyAction, capabilityCardAction } from "./actions";
import type { CapabilityCardEntry } from "@service-projects/core-auth";

export function RedeemClient({ code, signedIn }: { code: string; signedIn: boolean }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "working" }
    | { status: "error"; message: string }
    | { status: "done"; role: string; capabilities: CapabilityCardEntry[] }
  >({ status: "idle" });

  async function handleRedeem() {
    setState({ status: "working" });
    const result = await redeemInviteKeyAction(code);
    if (!result.ok || !result.grantedRole) {
      setState({ status: "error", message: result.error ?? "Could not redeem this key." });
      return;
    }
    const capabilities = await capabilityCardAction(result.grantedRole);
    setState({ status: "done", role: result.grantedRole, capabilities });
  }

  if (!signedIn) {
    const callbackUrl = encodeURIComponent(`/redeem/${code}`);
    return (
      <Card>
        <h1 style={{ marginTop: 0, fontSize: "var(--text-xl)" }}>You&apos;ve been invited</h1>
        <p style={{ color: "var(--text-secondary)" }}>Sign in (or create an account) to redeem this key.</p>
        <a className="btn" href={`/api/auth/signin?callbackUrl=${callbackUrl}`}>
          Sign in to continue
        </a>
      </Card>
    );
  }

  if (state.status === "done") {
    return (
      <Card>
        <h1 style={{ marginTop: 0, fontSize: "var(--text-xl)" }}>You&apos;re in</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          This key granted you the <Badge>{state.role}</Badge> role. Here&apos;s what you can do now:
        </p>
        <ul style={{ display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
          {state.capabilities
            .filter((c) => c.granted)
            .map((c) => (
              <li key={c.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span aria-hidden style={{ color: "var(--color-accent-500)" }}>
                  ✓
                </span>
                <span>
                  {c.label}
                  {c.note && <span style={{ color: "var(--text-secondary)" }}> — {c.note}</span>}
                </span>
              </li>
            ))}
        </ul>
        <a className="btn" href="/">
          Go to your dashboard
        </a>
      </Card>
    );
  }

  return (
    <Card>
      <h1 style={{ marginTop: 0, fontSize: "var(--text-xl)" }}>You&apos;ve been invited</h1>
      <p style={{ color: "var(--text-secondary)" }}>Redeem this key to unlock your role.</p>
      {state.status === "error" && <p style={{ color: "var(--color-danger-600, crimson)" }}>{state.message}</p>}
      <Button onClick={handleRedeem} disabled={state.status === "working"}>
        {state.status === "working" ? "Redeeming…" : "Redeem key"}
      </Button>
    </Card>
  );
}
