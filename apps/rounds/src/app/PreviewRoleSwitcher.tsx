"use client";

import { useTransition } from "react";
import { setPreviewRole } from "./preview-role-actions";
import { t } from "@/copy";

const ROLE_OPTIONS = ["REAL", "OWNER", "ADMIN", "COORDINATOR", "VOLUNTEER", "PREVIEWER"] as const;

export function PreviewRoleSwitcher({ currentPreview }: { currentPreview: string }) {
  const [, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => setPreviewRole(formData))}
      style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
    >
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
        {t("preview.label")}
      </span>
      <select
        name="role"
        defaultValue={currentPreview}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          padding: "var(--space-1) var(--space-2)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-default)",
          background: "var(--surface-sunken)",
          color: "var(--text-primary)",
          fontSize: "var(--text-sm)",
        }}
      >
        {ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>
            {role === "REAL" ? t("preview.real") : role}
          </option>
        ))}
      </select>
    </form>
  );
}
