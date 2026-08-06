"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Card } from "@service-projects/ui";
import { t } from "@/copy";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Only enforced when the field is filled in — a returning user
    // signing back in via this same form has no reason to fill it.
    if (confirmPassword && password !== confirmPassword) {
      setError(t("register.error.mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("register.error.generic"));
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(t("register.error.generic"));
        return;
      }
      window.location.href = "/";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <h1 style={{ margin: "0 0 4px", fontSize: "var(--text-xl)", fontWeight: "var(--weight-semibold)" }}>
          {t("register.title")}
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t("register.subtitle")}</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxWidth: 360 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {t("register.form.email")}
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {t("register.form.password")}
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {t("register.form.confirmPassword")}
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {t("register.form.confirmPasswordHint")}
            </span>
          </label>

          {error && (
            <p style={{ color: "var(--color-danger-500)", fontSize: "var(--text-sm)" }}>{error}</p>
          )}

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? t("register.form.submitting") : t("register.form.submit")}
          </Button>
        </form>
      </Card>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-default)",
  background: "var(--surface-sunken)",
  color: "var(--text-primary)",
};
